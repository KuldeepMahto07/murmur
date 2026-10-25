# Cohort analysis

**Status: Not started (plan written).** Part of [13 · Analytics](../README.md) in the [Murmur SaaS plan](../../README.md).

- **Cohorts:** install week × segment (role from first-run survey: researcher, journalist, legal/HR, other) × hardware (GPU / CPU-only).
- **Metrics per cohort:** week-1, week-4 and week-12 "active" (≥ 1 transcript that week), hours transcribed, % converted to Pro.
- **Questions to answer:**
  1. Do CPU-only users churn faster? If so, either set expectations harder or offer a cloud add-on.
  2. Do researchers come in seasonal waves (thesis deadlines)? If so, time campaigns to them.
- **Tool:** export the events to DuckDB or Metabase. No need for a paid product analytics tool at this scale.
