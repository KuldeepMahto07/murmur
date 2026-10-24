# Cohort analysis

**Status: Not started.** Part of [13 · Analytics](../README.md) in the [Harbor SaaS plan](../../README.md).

- **Cohorts:** group users by install week and by channel (Chrome Web Store, Edge Add-ons, winget, Microsoft Store, website).
- **Retention:** a user counts as retained in week N if their install ID made an update check that week.
- **Questions to answer:**
  1. Do winget users (technical) retain better than store users?
  2. Do users whose first download was over 1 GB stay longer? If so, aim onboarding at big files.
  3. Does using the video button in week 1 predict buying Pro?
- **Tool:** a SQLite or DuckDB notebook over the exported event log is enough until there are about 10k weekly actives.
