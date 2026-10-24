# 06 · Infrastructure

**Status: in progress.** Back to the [overview](../README.md).

| Sub-item | Status | Summary |
|---|---|---|
| [Cloud hosting](cloud-hosting/) | Not started | Harbor runs on the user's PC, so there is no app server to host. The only hosted pieces are: |
| [DevOps](devops/) | In progress | Installer built and tested (`npm run installer`); code signing next (needs a certificate) |
| [CI/CD](ci-cd/) | Ready (not yet run on GitHub) | Path-filtered GitHub Actions workflow on Windows: unit, engine, extension, store-build and tray suites; nightly public test. Not run on GitHub yet |
| [Monitoring](monitoring/) | Not started | A desktop app has no servers to monitor. What matters is release health: |
| [Security](security/) | Partial | Loopback guards + optional browser pairing done; encrypt cookies at rest next |
