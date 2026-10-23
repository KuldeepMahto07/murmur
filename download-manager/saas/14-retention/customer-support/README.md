# Customer support

**Status: In progress.** Part of [14 · Retention](../README.md) in the [Fetchline SaaS plan](../../README.md).

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
- **Next:** GitHub issue templates and an in-app "Copy diagnostics" button.
