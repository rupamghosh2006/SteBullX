# Security

SteBullX is non-custodial: it never requests keys, signs user transactions, or holds
funds. API inputs are range-validated by the scenario engine. Hosted deployments can set
`STEBULLX_API_KEY` to require constant-time checked API-key authentication for simulation
creation/retrieval.

Before a public deployment, add durable rate limiting, per-principal RBAC, audit logging,
secret management, encrypted managed PostgreSQL backups, dependency scanning, a reviewed
Soroban deployment, and monitoring/alerting. Do not expose operational decisions based
on a DEMO or uncalibrated result.
