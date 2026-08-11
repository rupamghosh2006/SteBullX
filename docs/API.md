# API

SteBullX is infrastructure first: every simulation is reproducible and addressable by a
deterministic id. Supply `x-api-key` when `STEBULLX_API_KEY` is configured (timing-safe
compare). The result includes `audit.deterministicId`, input/scenario/result SHA-256
hashes, source provenance, model version, data-quality assessment, assumptions, and the
full cascade.

## Stress testing

`POST /api/v1/stress-tests` runs the supported Blend/XLM-USDC model synchronously and
returns `201` with the full result.

```json
{
  "protocol": "blend",
  "scenario": {
    "name": "XLM -30% / liquidity -50%",
    "assetPriceShocks": { "XLM": -0.3 },
    "liquidityShocks": { "XLM_USDC": -0.5 },
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

The oracle object models feed misbehavior during the shock: `delaySeconds` (lag before
the oracle starts moving), `rampSeconds` (linear transition period), `divergence` (bias
relative to the true price, e.g. `+0.05`), `staleAfterSeconds` (feed freezes after N
seconds), and `failure` (feed never moves, valuations pinned at the pre-shock price).
`oracleDelaySeconds` is accepted as a back-compat alias for `delaySeconds`.

`POST /api/v1/stress-tests/async` enqueues the same payload and returns `202` with a
`jobId`. Poll `GET /api/v1/jobs/:id`; the result is embedded when the job `SUCCEEDED`.
With `REDIS_URL` set, jobs are durable and processed by the background worker
(`npm run worker`, see `docker-compose.yml`); without it, jobs complete in-process.

`GET /api/v1/stress-tests/:id` fetches a stored result by deterministic id
(`STRESS-...`).

## Historical replay

The archive (`src/data/historical-archive.ts`) stores ledger-pinned historical episodes.

- `GET /api/v1/replays` — list episodes.
- `GET /api/v1/replays/:id` — single episode with model-predicted and observed metrics.
- `POST /api/v1/replays/:id/replay` — reconstruct state at the episode's start ledger,
  replay the market movement, and return prediction-vs-observed errors plus warnings
  (`REPLAY-...` id).

## Observability

`GET /api/v1/metrics` exposes counters and durations collected by the instrumentation
layer (`src/services/observability.ts`), e.g. `simulation.runs`,
`replay.runs`, `api.stress-test.latency_ms`.

## Discovery

Read-only endpoints: `GET /api/v1/protocols`, `/markets`, `/liquidity`, and
`/positions`. Their `data` object is authoritative for whether a response is DEMO,
LIVE, INDEXED, CACHED, or HISTORICAL.
