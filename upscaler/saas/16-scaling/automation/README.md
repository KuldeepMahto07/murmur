# Automation

**Status: Not started (plan written).** Part of [16 · Scaling](../README.md) in the [Clarion SaaS plan](../../README.md).

- Autoscale GPU workers on queue depth (serverless first; reserved pods once utilisation passes 40%).
- Automatic credit refunds on failure; nightly reconciliation of the Stripe ledger.
- Auto-generated SEO pages from new preset benchmarks; automatic changelog emails.
- Run the nightly e2e GPU regression (`scripts/e2e.py`) on staging.
