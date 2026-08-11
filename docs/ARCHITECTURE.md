# Architecture

SteBullX treats the dashboard as one client of a deterministic risk service.

```text
Protocol adapter + market-data adapter
               ↓
       provenance-tagged snapshot
               ↓
revaluation → execution model → cascade → risk/data-quality assessment
               ↓
       auditable stress-test result
               ↓
 Next.js API / PostgreSQL / dashboard / Soroban hash attestation
```

`src/engine` is protocol-agnostic. It receives `ProtocolSnapshot`,
`StressScenario`, and liquidity snapshots through contracts in `src/core/types.ts`.
Protocol-specific extraction remains behind `ProtocolAdapter`; venue-specific data remains
behind `MarketDataProvider`.

The current Blend adapter is intentionally a deterministic demo fixture. A production
indexer should write raw observations, canonical normalized snapshots, and ledger
metadata before invoking the engine. Redis, queues, object storage, historical replay,
and monitoring are deployment-scale extensions—not fictitious capabilities of the MVP.
