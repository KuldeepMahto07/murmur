# Automation

**Status: In progress.** Part of [16 · Scaling](../README.md) in the [Harbor SaaS plan](../../README.md).

**Built:** `npm run release` (`scripts/release.ts`) bumps the version in `package.json` and the extension manifest, writes release notes from the git log, and builds the installer + zips — then prints the tag/push commands (it never pushes). Pushing a `v*` tag runs the `release` CI job, which rebuilds the artifacts and publishes a GitHub Release with them attached. **Still owner-gated:** code signing, the winget PR, and the Chrome/Edge store uploads (need the certificate and store accounts).

- **Releases:** tag → CI builds, signs, publishes the GitHub Release, opens the winget PR and uploads to the Chrome and Edge stores (both have publish APIs).
- **Site-compatibility regression suite:** a nightly run of the video-button detection against a list of permitted test pages, with alerts on change.
- **Support:** auto-label issues by template, ask for diagnostics automatically, and close stale "can't reproduce" issues after 30 days.
- **Licences:** fully handled by the merchant of record (keys, refunds, VAT). No manual steps.
