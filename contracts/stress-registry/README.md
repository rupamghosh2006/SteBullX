# SteBullX Stress Scenario Registry

This optional Soroban contract anchors a scenario hash and a completed result hash.
It does not run economic simulations or store their large output. That work belongs
off-chain, where executable liquidity and iterative risk models can be audited.

Writes require the publisher's standard Soroban authorization. Scenario IDs are
immutable, records carry a nonzero version and expiry, and expired records do not
verify. Deploy only after adding project-specific audit and network configuration.
