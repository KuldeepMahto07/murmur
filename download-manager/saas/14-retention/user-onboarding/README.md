# User onboarding

**Status: Done.** Part of [14 · Retention](../README.md) in the [Harbor SaaS plan](../../README.md).

**First-run flow, built into the desktop shell:**
1. Welcome: choose the download folder (default: Downloads\Harbor).
2. "Connect your browser": buttons for the Chrome Web Store and Edge Add-ons. The app polls `/api/ping` from the extension and ticks off when it's connected.
3. Pick your connection type (fast or unstable). This sets the default connection count and speed limit.
4. Test download: a small public file showing the segment map and a ✓ verified SHA-256. This is the "aha" moment.
5. Optional: telemetry opt-in, explained in plain words.

**Fixes a known pain:** the tray app (`desktop/`) already starts with Windows on request and sits in the tray. The remaining gap is an installer that sets it up and walks through these steps.

## Update (2026-10-24)
- **Built** in the app: a welcome dialog on first run, reopenable from Settings → *Setup guide*. It covers:
  1. Download folder (category folders follow it).
  2. Connect your browser. It shows **✔ Browser extension connected (vX)** live, because the extension now sends `X-Fetchline-Client` with every engine call. Until then it shows load-unpacked steps with the real path.
  3. Connection type: 8 or 4 connections.
  4. Start with Windows, through the tray script (`PUT /api/startup`).
  5. A test download of `patch-6.6.1.xz`, checked against kernel.org's published SHA-256, ending with "✔ verified".
- Checked in the browser pane on a fresh engine. The extension suite asserts the engine records the extension.
