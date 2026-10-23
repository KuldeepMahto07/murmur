# Automation

- **Releases:** tag → GitHub Actions builds and signs the installer → uploads to GitHub Releases + the update feed → posts the changelog. See [06-infrastructure/ci-cd](../../06-infrastructure/ci-cd/).
- **Licensing:** purchase webhook → the merchant of record generates and emails a signed key. No server of ours in the loop.
- **Support:** auto-reply with the diagnostics instructions and the top-5 FAQ; tag tickets by keyword.
- **Model updates:** a manifest (JSON on the CDN) listing recommended model versions; the app offers the upgrade in one click.
- **Reporting:** a weekly KPI email generated from the analytics export ([13-analytics/kpi-dashboard](../../13-analytics/kpi-dashboard/)).
