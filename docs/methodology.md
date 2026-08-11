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
2. Model the oracle price path during the shock: configurable delay before the feed
   starts moving, a linear ramp to the shocked price, an optional divergence bias,
   optional staleness (feed freezes partway), and optional total failure (feed never
   moves, valuations pinned at the pre-shock price).
3. Revalue every position with published liquidation thresholds.
4. Queue previously unprocessed liquidatable positions.
5. Sell the modelled XLM seizure across execution venues in price-priority order:
   scenario-scaled SDEX bid levels first, then each constant-product AMM pool up to its
   execution cap (75% of pool reserves), using the best available reference price per
   venue. Each estimate carries a per-venue breakdown.
6. Measure average execution shortfall from the scenario reference price.
7. Apply 45% of realized impact to residual venue pricing as a deliberately conservative,
   inspectable cascade feedback rule.
8. Revalue all positions and repeat.

This does not model latency, bot competition, partial debt repayment, protocol-specific
close factors, bridge risk, issuer risk, order cancellation, or adaptive cross-venue
routing. Those must be added protocol by protocol before an operational deployment.

## Reproducibility

Use the reported scenario configuration, source timestamp, source class, methodology
version, and fixture/indexer snapshot to reproduce a report. The report ID is unique but
is not itself a reproducibility input. A production attestation workflow should hash a
canonical JSON serialization of the scenario and result before submitting those hashes to
the Soroban registry.
