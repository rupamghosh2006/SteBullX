# STE BULL X / SteBullX

> **Stress-test Stellar DeFi before it gets rekt.**

SteBullX is open-source economic risk infrastructure for Stellar DeFi. It asks a
different question from a protocol health-factor view: **if many positions become
liquidatable together, can available market liquidity actually absorb the sales?**

The MVP simulates an XLM price shock, an XLM/USDC liquidity contraction, liquidation
execution, estimated bad debt, and iterative liquidation feedback. It integrates with
Stellar rather than replacing Blend, the Stellar DEX, AMMs, price feeds, or
liquidators.

## Important data notice

The shipped dashboard is clearly labelled **DEMO / REPRODUCIBLE**. Its Blend positions,
risk parameters, and liquidity book are a deterministic hand-authored fixture in
`src/data/demo-blend-snapshot.ts`; they are **not** Stellar or Blend mainnet data.
Every report returns its data class, source, timestamp, and method version.

An optional `StellarHorizonMarketDataProvider` can retrieve a live Stellar SDEX
XLM/USDC order book only after `STELLAR_USDC_ISSUER` has been set from a verified
issuer source. It throws if it is not configured; it never falls back to invented
live data. A production Blend indexer plugs into the existing `ProtocolAdapter`
interface and must attach its source ledger/timestamp before it can be labelled LIVE
or INDEXED.

## Run it

```bash
copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For the reproducible full stack:

```bash
docker compose up --build
```

The Compose stack starts the Next.js Node API/UI plus PostgreSQL. With `DATABASE_URL`
configured, completed reports are persisted; without it, local reports are intentionally
in-memory and disappear at restart.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/protocols` | Supported protocol adapters and their data status |
| `GET /api/protocols/blend/markets` | Supported markets plus provenance |
| `GET /api/scenarios` | Starter stress scenarios |
| `POST /api/stress-test` | Run a simulation |
| `GET /api/stress-tests/:id` | Retrieve a completed result |

The versioned developer API is available under `/api/v1` (`/protocols`,
`/markets`, `/liquidity`, `/positions`, and `/stress-tests`). Set
`STEBULLX_API_KEY` in a hosted deployment to require an `x-api-key` header for
stress-test creation and retrieval. The read-only MVP dataset endpoints remain
open to support reproducible public demonstrations.

Example request:

```json
{
  "protocol": "blend",
  "scenario": {
    "name": "XLM -20% / liquidity -40%",
    "assetPriceShocks": { "XLM": -0.2 },
    "liquidityShocks": { "XLM_USDC": -0.4 },
    "oracleDelaySeconds": 30,
    "maxCascadeIterations": 10,
    "maxSlippage": 0.1
  }
}
```

## Model methodology

For each position, the engine calculates:

```text
collateral_value = Σ(collateral_amount × shocked_USD_price)
debt_value       = Σ(debt_amount × shocked_USD_price)
health_factor    = Σ(collateral_value_by_asset × liquidation_threshold) / debt_value
LTV              = debt_value / collateral_value
```

Classifications are HEALTHY (HF ≥ 1.15), AT_RISK (1.00–1.15), LIQUIDATABLE
(0.75–1.00), and SEVERELY_UNDERCOLLATERALIZED (< 0.75). For liquidatable XLM
positions, the model sells enough XLM to target debt plus the configured liquidation
bonus, capped by XLM collateral. It consumes modeled SDEX bid levels in price order
and then uses a constant-product AMM approximation. It measures execution shortfall
against the scenario reference price, feeds a disclosed portion of the impact into the
next market round, and repeats until no new positions are liquidatable or the iteration
limit is reached.

**Liquidation Capacity** is the largest $50k-grid sale which completely executes within
the selected slippage limit in the scenario-scaled liquidity state. It is a model-derived
estimate, not a guaranteed liquidation amount or market quote.

Risk score components are observable and weighted: 20% liquidation exposure, 25%
liquidity coverage gap, 20% execution slippage, 15% cascade depth, and 20% modeled bad
debt. See [docs/methodology.md](docs/methodology.md) for limits and assumptions.

## Architecture

```text
src/
  app/api/             Node/TypeScript API routes
  core/                Stable domain contracts and math
  data/                Explicitly labelled deterministic demo fixture
  engine/              Revaluation, execution, cascade, risk-score engines
  market-data/         Pluggable Stellar market data provider
  protocols/blend/     MVP Blend adapter
  services/            PostgreSQL/in-memory report persistence
contracts/
  stress-registry/     Optional Soroban hash-attestation contract
services/api/          PostgreSQL schema and API deployment notes
tests/                 Deterministic unit tests
docs/                  Methodology, integrity, and proposal material
```

## Soroban attestation layer

`contracts/stress-registry` exists solely to anchor a compact scenario hash and result
hash on Soroban. Simulations and their large artifacts remain off-chain because economic
models require market snapshots and iterative computation. The contract requires the
publisher’s authorization, rejects duplicate IDs, validates expiry/version, and permits
verification of an immutable published pair. It does not custody funds.

## Scope and next integration step

This is a technically focused MVP: one protocol adapter, XLM/USDC, deterministic
scenario tests, and a no-custody dashboard. The highest-value next step is a verified,
ledger-pinned Blend indexing adapter, followed by venue-complete liquidity adapters and
historical replay. Do not use the demo output for investment, operational, or solvency
decisions.

## License

MIT — add a `LICENSE` file before a public release.
