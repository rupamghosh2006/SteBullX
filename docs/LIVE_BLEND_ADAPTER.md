# Live data: Blend adapter and market data

SteBullX ships in DEMO mode by default. The engine is adapter-driven: any source
that produces a `ProtocolSnapshot` through the documented contracts is scored,
labelled, and simulated identically.

## Enabling live data

| Env | Effect |
| --- | --- |
| `DATA_SOURCE=live` | Switches protocol reads to the live adapter. |
| `BLEND_API_URL` | Base URL of the Blend index endpoint (required when live). |
| `STELLAR_USDC_ISSUER` | Verifies the SDEX order book + constant-product XLM/USDC pool reads. |
| `STELLAR_HORIZON_URL` | Horizon endpoint (defaults to testnet). |

Live mode **throws** when required configuration is missing; it never falls back
to invented live data. API routes return `503` with the reason.

## Blend positions: what "live" means

Blend does not expose a public REST API for borrower positions. Positions live in
the Soroban pool contract (`get_positions(address)` per address, protocol
bTokens/dTokens converted via reserve `bRate`/`dRate`), so enumerating them
requires an event indexer (PoolEvents: Deposit, Withdraw, Borrow, Repay,
FillLiquidation, ...). The `@blend-capital/blend-sdk` reads pool/reserve/user
state from an RPC once addresses are known.

`BLEND_API_URL` must point at a service producing the normalized snapshot payload
below (e.g. a scheduled indexer built with the SDK). The adapter is in
`src/protocols/blend/api-adapter.ts`; `parseBlendSnapshotPayload` validates every
field and throws on malformed input.

```json
{
  "capturedAt": "2026-08-12T10:00:00.000Z",
  "ledger": 12842192,
  "source": "https://indexer.example/blend",
  "assets": [{ "id": "XLM", "symbol": "XLM", "decimals": 7 }],
  "risk": {
    "collateralFactor":     { "XLM": 0.9 },
    "liquidationThreshold": { "XLM": 0.85 },
    "liquidationBonus":     { "XLM": 0.05 }
  },
  "positions": [
    { "id": "G...", "collateral": [{ "assetId": "XLM", "amount": 12345.67 }],
      "debt": [{ "assetId": "USDC", "amount": 100.5 }], "openedAt": "2026-01-01T00:00:00Z" }
  ],
  "markets": [
    { "id": "XLM_USDC", "baseAssetId": "XLM", "quoteAssetId": "USDC",
      "spotPrice": 0.4, "executableDepthUsd": 123456 }
  ]
}
```

Provenance is labelled `INDEXED` ("normalized Blend index snapshot") with the
`capturedAt` timestamp and the source's ledger sequence when supplied.

## Market data (SDEX book + pools)

With `STELLAR_USDC_ISSUER` set, the resolver layers the live order book and
liquidity over the Blend snapshot:

- Order book: `GET /order_book?buying=USDC:<issuer>&selling=native` —
  `StellarHorizonMarketDataProvider.getOrderBook`.
- Constant-product pools: `GET /liquidity_pools` (paginated, best-effort up to
  five pages), filtered client-side to pools whose only reserves are native XLM
  and `USDC:<issuer>`, mapped via `fee_bp` and reserve amounts
  (`getPools` / `getLiquiditySnapshot`). Pool participation stays capped at
  `POOL_EXECUTION_CAP` in the engine.

## Capturing replay archives

`npm run archive` (scripts/archive.ts) captures the resolved live snapshot as a
HISTORICAL episode and appends it to the tiered store (PostgreSQL
`replay_archives`, else Redis, else a local JSON file). Running it on a schedule
gives you real, ledger-pinned replay episodes:

- each capture records the price path and stores the prior snapshot as the
  episode start;
- observed liquidation volume / bad debt / affected positions are computed by
  revaluing the prior snapshot at the new price with the same engine
  (`observeBetween` in src/services/archiver.ts) — model-derived observations,
  labelled as such in the episode note;
- a liquidation-event indexer (parsing `FillLiquidation` events) can replace the
  observer later without touching the replay engine.

Replayed archives appear in `/replay` and under `/api/v1/replays` with fixture
episodes, fully distinguished by provenance and note.