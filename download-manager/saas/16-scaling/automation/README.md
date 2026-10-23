# Automation

**Status: Not started.** Part of [16 · Scaling](../README.md) in the [Fetchline SaaS plan](../../README.md).

- **Releases:** tag → CI builds, signs, publishes the GitHub Release, opens the winget PR and uploads to the Chrome and Edge stores (both have publish APIs).
- **Site-compatibility regression suite:** a nightly run of the video-button detection against a list of permitted test pages, with alerts on change.
- **Support:** auto-label issues by template, ask for diagnostics automatically, and close stale "can't reproduce" issues after 30 days.
- **Licences:** fully handled by the merchant of record (keys, refunds, VAT). No manual steps.
