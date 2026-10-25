# Feature adoption

**Status: Not started (plan written).** Part of [14 · Retention](../README.md) in the [Murmur SaaS plan](../../README.md).

**Under-discovered features in the current UI:** search, playback speed, speaker reassignment per turn, translated exports, bulk ZIP.

**Tactics:**
- One-time contextual tips (dismissible). For example, after the first transcript: "Tip: click any timestamp to play from there." After the speaker rename: "Wrong speaker? Turn on Edit text and use the dropdown."
- A "What's new" panel after each update, with one GIF.
- Track adoption with the opt-in `export_downloaded` / `translation_run` events. If a feature stays under 10% adoption after 2 releases, either surface it better or cut it.
