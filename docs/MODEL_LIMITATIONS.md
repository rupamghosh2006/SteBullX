# Model limitations

The MVP estimates scenarios; it does not predict the future. It uses a disclosed order
book plus constant-product AMM approximation, a $50k liquidation-capacity grid, and a
45% execution-impact feedback rule. It does not yet model verified Blend close factors,
liquidator competition, oracle divergence behavior, multiple external venues, cancelled
orders, stablecoin depegs, latency, bridge risk, or historical calibration.

Its confidence score measures data/model suitability—not a probability of correctness.
For the packaged `DEMO` snapshot, confidence is deliberately LOW.
