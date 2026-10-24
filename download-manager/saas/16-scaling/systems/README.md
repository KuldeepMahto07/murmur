# Systems

**Status: Not started.** Part of [16 · Scaling](../README.md) in the [Harbor SaaS plan](../../README.md).

| System | Choice |
|---|---|
| Source and CI | GitHub, with path-filtered Actions (this repo also holds other projects) |
| Payments, licences, tax | Merchant of record (Lemon Squeezy or Paddle) |
| Website and update feed | Cloudflare Pages |
| Support | GitHub Issues and Discussions, plus a shared inbox |
| Analytics | Plausible (web) and a self-hosted opt-in event store (SQLite/DuckDB) |
| Docs | This `saas/` tree plus a public docs site generated from the README files |

Write a one-page runbook for each: release, refund, security report, store rejection.
