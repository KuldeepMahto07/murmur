# Integrations

**Status: Done.** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

| Integration | Code | Status |
|---|---|---|
| Browser extension (MV3, Chrome and Edge) | [`extension/`](../../../extension/): `background.js` (media sniffing, hand-off, context menu, download takeover), `content.js` (video button overlay), `popup.*` | ✅ verified in headless Edge |
| AB Download Manager hand-off | `extension/background.js` → AB DM `POST /add` | ✅ verified against real AB DM 1.11.1 |
| ffmpeg | `engine/hls.ts` (remux and merge audio) | ✅ optional; falls back to `.ts` |
| Native messaging | Not used: the extension calls the loopback API | Decided in [docs/plan.md](../../../docs/plan.md) |

**Missing:** a Firefox build (MV3 differences in `webRequest` and the background script) and an Opera listing.
