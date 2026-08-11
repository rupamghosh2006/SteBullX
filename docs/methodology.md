# SteBullX MVP methodology and limitations

## Purpose

SteBullX estimates the economic feasibility of liquidation under a named set of
assumptions. It is not an oracle, an execution venue, a liquidation bot, investment
advice, or a solvency guarantee.

## Data labels

| Label | Meaning |
| --- | --- |
| `LIVE` | Direct chain or venue response, time-stamped and ledger-pinned when possible |
| `INDEXED` | A third-party or project indexer response with source metadata |
| `CACHED` | A retained snapshot with original capture metadata |
| `HISTORICAL` | A historical, source-identified record |
| `DEMO` | A hand-authored deterministic fixture, never a chain claim |
| `SIMULATED` | Model output derived from one of the above |

The shipped data is `DEMO`. No market or protocol field should be promoted to LIVE by a
frontend label alone.

## Execution and cascade model

1. Apply per-asset price shocks and per-market liquidity shocks.
2. Revalue every position with published liquidation thresholds.
3. Queue previously unprocessed liquidatable positions.
4. Sell the modelled XLM seizure into scenario-scaled bid levels, then a constant-product
   AMM approximation when present.
5. Measure average execution shortfall from the scenario reference price.
6. Apply 45% of realized impact to residual venue pricing as a deliberately conservative,
   inspectable cascade feedback rule.
7. Revalue all positions and repeat.

This does not model latency, bot competition, partial debt repayment, protocol-specific
close factors, oracle behavior beyond the disclosed delay parameter, bridge risk, issuer
risk, order cancellation, or cross-venue routing. Those must be added protocol by
protocol before an operational deployment.

## Reproducibility

Use the reported scenario configuration, source timestamp, source class, methodology
version, and fixture/indexer snapshot to reproduce a report. The report ID is unique but
is not itself a reproducibility input. A production attestation workflow should hash a
canonical JSON serialization of the scenario and result before submitting those hashes to
the Soroban registry.
