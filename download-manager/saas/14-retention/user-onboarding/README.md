# User onboarding

**Status: Not started.** Part of [14 · Retention](../README.md) in the [Fetchline SaaS plan](../../README.md).

**First-run flow, built into the desktop shell:**
1. Welcome: choose the download folder (default: Downloads\Fetchline).
2. "Connect your browser": buttons for the Chrome Web Store and Edge Add-ons. The app polls `/api/ping` from the extension and ticks off when it's connected.
3. Pick your connection type (fast or unstable). This sets the default connection count and speed limit.
4. Test download: a small public file showing the segment map and a ✓ verified SHA-256. This is the "aha" moment.
5. Optional: telemetry opt-in, explained in plain words.

**Fixes a known pain:** the tray app (`desktop/`) already starts with Windows on request and sits in the tray. The remaining gap is an installer that sets it up and walks through these steps.
