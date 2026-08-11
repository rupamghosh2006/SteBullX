# API

`POST /api/v1/stress-tests` runs the supported Blend/XLM-USDC model. Supply `x-api-key`
when `STEBULLX_API_KEY` is configured. The result includes `audit.deterministicId`,
input/scenario/result SHA-256 hashes, source provenance, model version, data-quality
assessment, assumptions, and the full cascade.

```json
{
  "protocol": "blend",
  "scenario": {
    "name": "XLM -30% / liquidity -50%",
    "assetPriceShocks": { "XLM": -0.3 },
    "liquidityShocks": { "XLM_USDC": -0.5 },
    "oracleDelaySeconds": 30,
    "maxCascadeIterations": 10,
    "maxSlippage": 0.1
  }
}
```

Read-only discovery endpoints: `GET /api/v1/protocols`, `/markets`, `/liquidity`,
and `/positions`. Their `data` object is authoritative for whether a response is DEMO,
LIVE, INDEXED, CACHED, or HISTORICAL.
