# STE BULL X / SteBullX

> **Stress-test Stellar DeFi before it gets rekt.**

SteBullX is open-source economic risk infrastructure for Stellar DeFi. It asks a
different question from a protocol health-factor view: **if many positions become
liquidatable together, can available market liquidity actually absorb the sales?**

The MVP simulates an XLM price shock, an XLM/USDC liquidity contraction, liquidation
execution across the SDEX order book and AMM pools, estimated bad debt, and iterative
liquidation feedback. It integrates with Stellar rather than replacing Blend, the
Stellar DEX, AMMs, price feeds, or liquidators.

## What's inside

- **Deterministic stress-test engine** — price/liquidity shocks, an oracle-misbehavior
  model (delay, ramp, divergence, staleness, total failure), multi-venue execution, and
  iterative cascade until no new positions are liquidatable.
- **Historical replay** — ledger-pinned episodes replayed against archived outcomes to
  measure prediction-vs-observed error and calibrate the model.
- **Async job queue** — durable Redis-backed queue with a background worker; falls back
  to in-process execution when no Redis is configured, so it runs anywhere.
- **Observability** — structured JSON logs, counters and timing metrics behind
  `GET /api/v1/metrics`.
- **Multi-page dashboard** — Overview, Stress Lab, Protocols, Markets, Liquidations,
  Scenarios, Historical Replay, Risk Reports, API reference, and Documentation.

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
in-memory and disappear at restart. Async jobs run in-process unless `REDIS_URL` is set;
with Redis, run the worker loop in a separate process:

```bash
npm run worker
```

## Live data mode

The default is deterministic DEMO mode. Set `DATA_SOURCE=live` with `BLEND_API_URL`
pointing at a normalized Blend index (see [docs/LIVE_BLEND_ADAPTER.md](docs/LIVE_BLEND_ADAPTER.md)
for the payload contract and what "live" means for Blend positions) to serve real
positions; with `STELLAR_USDC_ISSUER` also set, the live SDEX order book and
constant-product XLM/USDC pools are layered in for execution depth. Live mode throws
rather than silently mixing in demo data, and routes return `503` with the reason when
a live source is unavailable.

Capture replay episodes on a schedule from the live source:

```bash
npm run archive
```

Each capture is stored as a HISTORICAL episode (PostgreSQL `replay_archives`, else
Redis, else a local file), measures the move against the previous capture, and feeds
the `/replay` dashboard and replay API — turning the stress-test model into a
calibration loop against captured state.

## API

The versioned developer API lives under `/api/v1`. Set `STEBULLX_API_KEY` in a hosted
deployment to require an `x-api-key` header for stress-test creation and retrieval.
The read-only MVP dataset endpoints remain open to support reproducible public
demonstrations. `GET /api/v1/metrics` needs no key.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/protocols` | Supported protocol adapters and their data status |
| `GET /api/v1/markets` | Markets with spot reference and executable depth |
| `GET /api/v1/positions` | Protocol positions from the active snapshot |
| `GET /api/v1/liquidity` | Order-book levels and AMM pools |
| `POST /api/v1/stress-tests` | Run a stress test synchronously (201 + full result) |
| `POST /api/v1/stress-tests/async` | Enqueue a stress test (202 + job id) |
| `GET /api/v1/stress-tests/:id` | Fetch a stored result by deterministic id |
| `GET /api/v1/jobs/:id` | Poll job status; result included when done |
| `GET /api/v1/replays` | Historical replay archive episodes |
| `GET /api/v1/replays/:id` | Single archived episode |
| `POST /api/v1/replays/:id/replay` | Run a replay, get prediction-vs-observed errors |
| `GET /api/v1/metrics` | Observability counters and durations |

Unversioned convenience routes also exist for the dashboard: `POST /api/stress-test`,
`GET /api/scenarios`, `GET /api/protocols`, and `GET /api/protocols/:id/markets`.

Example request:

```json
{
  "protocol": "blend",
  "scenario": {
    "name": "XLM -20% / liquidity -40%",
    "assetPriceShocks": { "XLM": -0.2 },
    "liquidityShocks": { "XLM_USDC": -0.4 },
    "oracle": {
      "delaySeconds": 30,
      "rampSeconds": 30,
      "divergence": 0,
      "staleAfterSeconds": 0,
      "failure": false
    },
    "maxCascadeIterations": 10,
    "maxSlippage": 0.1
  }
}
```

`oracleDelaySeconds` is accepted as a back-compat alias for `oracle.delaySeconds`.

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
bonus, capped by XLM collateral.

**Oracle path** — the feed moves from the pre-shock price to the shocked price after
`delaySeconds`, over a `rampSeconds` linear transition, optionally with a `divergence`
bias. `staleAfterSeconds` freezes the feed mid-crash and `failure` pins valuations at
the pre-shock price entirely, so liquidations only trigger for positions already
underwater.

**Execution** — each sale fills venues in price-priority order: scenario-scaled SDEX
bid levels first, then each constant-product AMM pool up to an execution cap of 75% of
pool reserves. Every estimate carries a per-venue breakdown. The model measures
execution shortfall against the scenario reference price, feeds 45% of the realized
impact into the next market round as a conservative feedback rule, and repeats until no
new positions are liquidatable or the iteration limit is reached.

**Liquidation Capacity** is the largest $50k-grid sale which completely executes within
the selected slippage limit in the scenario-scaled liquidity state. It is a model-derived
estimate, not a guaranteed liquidation amount or market quote.

Risk score components are observable and weighted: 20% liquidation exposure, 25%
liquidity coverage gap, 20% execution slippage, 15% cascade depth, and 20% modeled bad
debt. See [docs/methodology.md](docs/methodology.md) for limits and assumptions.

## Architecture

```text
src/
  app/                 Next.js pages (multi-page dashboard) and API routes
  components/          Shared UI primitives and the topbar navigation
  core/                Stable domain contracts and math
  data/                Explicitly labelled deterministic demo fixture + historical archive
  engine/              Revaluation, execution, cascade, risk-score, replay engines
  lib/                 Canned deterministic analytics for the dashboard
  market-data/         Pluggable Stellar market data provider (Horizon; live
                       order book, spot, constant-product XLM/USDC pools)
  protocols/blend/     MVP Blend adapter (DEMO) + live Blend index adapter
  services/            Persistence, data-source resolver, Redis queue, worker
                       jobs, observability, snapshot archiver
scripts/
  worker.ts            Background job worker loop (Redis)
  archive.ts           Historical episode capture (`npm run archive`)
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
scenario tests, historical replay for calibration, and a no-custody dashboard. The
highest-value next step is a verified, ledger-pinned Blend indexing adapter, followed
by venue-complete liquidity adapters and multi-protocol stress testing. Do not use the
demo output for investment, operational, or solvency decisions.

## License

MIT — add a `LICENSE` file before a public release.
