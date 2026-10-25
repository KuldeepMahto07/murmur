# Customer support

**Status: In progress.** Part of [14 · Retention](../README.md) in the [Harbor SaaS plan](../../README.md).

- **Channels:**
  - GitHub Issues for bugs, with templates for "download fails on a site", "extension not connecting" and "crash".
  - GitHub Discussions for questions.
  - A support email for licence and payment issues.
- **Self-serve:** an in-app "Copy diagnostics" button (version, OS, settings, log tail with **URLs redacted**).
- **Top FAQ, written before launch:**
  1. Why doesn't YouTube, Netflix or a DRM site work? (Policy and law; suggest legitimate options.)
  2. The extension says "not running". (Start the app or check the port; covers the old-instance case fixed in `engine/main.ts`.)
  3. Windows SmartScreen warning. (Only until signing is done.)
  4. How do I send downloads to AB Download Manager instead?
- **Response target:** 48 h free, 24 h Pro.

## Update (2026-10-24)
- The public FAQ is live in [`site/faq.html`](../../../site/faq.html). It covers YouTube/Instagram/DRM, "not running", "no stream seen yet", SmartScreen, speed, crash recovery, SHA-256, AB DM and privacy.

## Update (2026-10-25)
- **GitHub issue templates built** in [`.github/ISSUE_TEMPLATE/`](../../../.github/ISSUE_TEMPLATE/): a bug-report form (with a diagnostics field and a "no URLs/file names" reminder), a feature-request form, and a config that disables blank issues and links security reports to a private advisory. They sit under `download-manager/` so they travel with the project to its own repo — move them to the repo root there for GitHub to pick them up.
- **In-app "Copy Diagnostics" built:** Settings → Help. The engine's `GET /diagnostics` returns versions, the update state, the licence tier, download counts by status and the main settings — **no URLs, file names, folders, keys or e-mail**, and the video helper is named neutrally.
- **Next (owner):** a support e-mail for licence/payment issues, and moving the templates to the repo root once Harbor has its own repository.
