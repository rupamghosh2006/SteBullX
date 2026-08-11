# Architecture

SteBullX treats the dashboard as one client of a deterministic risk service.

```text
Protocol adapter + market-data adapter
               ↓
       provenance-tagged snapshot
               ↓
revaluation → multi-venue execution → cascade → risk/data-quality assessment
               ↓
       auditable stress-test result
               ↓
 Next.js API / async job queue / observability / dashboard / Soroban attestation
```

`src/engine` is protocol-agnostic. It receives `ProtocolSnapshot`,
`StressScenario`, and liquidity snapshots through contracts in `src/core/types.ts`.
Protocol-specific extraction remains behind `ProtocolAdapter`; venue-specific data remains
behind `MarketDataProvider`.

Execution routes liquidation flow across the SDEX order book and one or more AMM pools
(`LiquiditySnapshot.amms`, each capped at `POOL_EXECUTION_CAP` = 75% of reserves),
producing a per-venue breakdown on every estimate.

The current Blend adapter is intentionally a deterministic demo fixture. A production
indexer should write raw observations, canonical normalized snapshots, and ledger
metadata before invoking the engine. Redis (`REDIS_URL`) makes the job queue
(`src/services/queue.ts`) durable and processes jobs in the background worker
(`scripts/worker.ts`, `npm run worker`); without it, async jobs complete in-process so
the MVP deploys anywhere. Historical replay (`src/engine/replay.ts` +
`src/data/historical-archive.ts`) and observability (`src/services/observability.ts`)
are live MVP features; object storage and Soroban hash attestation remain
deployment-scale extensions.
