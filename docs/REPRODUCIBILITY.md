# Reproducibility

The simulation ID is deterministic: `STRESS-` plus the first 16 uppercase characters of
the SHA-256 hash of canonicalized snapshot, scenario, and model version. `inputHash`
identifies those inputs; `scenarioHash` identifies the scenario; `resultHash` identifies
the deterministic computational result excluding runtime generation time.

For a reproducible production report persist the complete source snapshot, source ledger,
scenario JSON, methodology/model version, all assumptions, and all three hashes. The
MVP's `DEMO` fixture has no source ledger and must never be treated as a historical or
chain-derived reproduction.
