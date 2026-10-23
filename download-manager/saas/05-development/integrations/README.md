# Integrations

**Status: Done.** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

| Integration | Code | Status |
|---|---|---|
| Browser extension (MV3, Chrome and Edge) | [`extension/`](../../../extension/): `background.js` (media sniffing, hand-off, context menu, download takeover), `content.js` (video button overlay), `popup.*` | ✅ verified in headless Edge |
| AB Download Manager hand-off | `extension/background.js` → AB DM `POST /add` | ✅ verified against real AB DM 1.11.1 |
| ffmpeg | `engine/hls.ts` (remux and merge audio) | ✅ optional; falls back to `.ts` |
| yt-dlp (YouTube, Instagram and ~1,800 sites) | [`engine/ytdlp.ts`](../../../engine/ytdlp.ts): probe through `POST /api/ytdlp/probe`, and download kind `ytdlp` with progress, pause (kills the process tree) and resume (`--continue`), plus a SHA-256. The extension's `background.js` adds the yt-dlp menu entries and sends the page's cookies as a temporary cookies file | ✅ verified on YouTube (`verify-extension.ts --youtube`). Needs `winget install yt-dlp.yt-dlp` (brings Deno and FFmpeg) |
| Native messaging | Not used: the extension calls the loopback API | Decided in [docs/plan.md](../../../docs/plan.md) |

**Missing:** a Firefox build (MV3 differences in `webRequest` and the background script) and an Opera listing.
