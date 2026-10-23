# Monitoring

**Status: Not started.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

A desktop app has no servers to monitor. What matters is release health:
- **Opt-in crash reports:** off by default. When an engine run hits an error, offer "send report", which sends the log tail and versions but no URLs or cookies.
- **Store metrics:** Chrome Web Store and Edge dashboards (installs, uninstalls, ratings), checked weekly.
- **Update check:** count requests for `latest.json` (Cloudflare analytics) as a privacy-safe proxy for active installs.
- **Support inbox and GitHub issues:** label `bug`, `regression` or `site-compat`.
