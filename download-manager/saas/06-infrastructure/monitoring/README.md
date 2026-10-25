# Monitoring

**Status: Partial.** Part of [06 · Infrastructure](../README.md) in the [Harbor SaaS plan](../../README.md).

A desktop app has no servers to monitor. What matters is release health:
- **Opt-in crash reports:** off by default. When an engine run hits an error, offer "send report", which sends the log tail and versions but no URLs or cookies.
- **Store metrics:** Chrome Web Store and Edge dashboards (installs, uninstalls, ratings), checked weekly.
- **Update check:** count requests for `latest.json` (Cloudflare analytics) as a privacy-safe proxy for active installs.
- **Support inbox and GitHub issues:** label `bug`, `regression` or `site-compat`.

## Update (2026-10-25)
- **Crash reports without a server:** Copy Diagnostics now includes an `Errors:` line with the five most common error messages, URLs, hosts and paths redacted (`redactError` / `errorSummary` in `engine/server.ts`, unit-tested). Users paste it into a bug report, so nothing is sent automatically.
- **Still to do (after launch):** count `latest.json` / Releases API hits once the site is hosted, and check the store dashboards weekly.
