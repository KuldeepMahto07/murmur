# Backend

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

**Code lives in [`download-manager/engine/`](../../../engine/).** Run it with `node engine/main.ts` or `start.bat`.

| File | Responsibility |
|---|---|
| [`engine/download.ts`](../../../engine/download.ts) | Segmented HTTP download: dynamic splitting, fsynced checkpoints, 16 KB resume re-check, retries, SHA-256 and MD5 |
| [`engine/hls.ts`](../../../engine/hls.ts) | HLS: master/variant parsing, parallel segments, ffmpeg remux; refuses encrypted or live streams |
| [`engine/manager.ts`](../../../engine/manager.ts) | Queue, categories, scheduler, crash recovery, atomic state saves |
| [`engine/limiter.ts`](../../../engine/limiter.ts) | Token buckets for global and per-download speed limits |
| [`engine/net.ts`](../../../engine/net.ts) | HTTP client: keep-alive agents, redirects, filename parsing |
| [`engine/main.ts`](../../../engine/main.ts) | Entry point; port claim, so a second or older instance is handled |

Design notes: [docs/plan.md](../../../docs/plan.md).
