# Unit testing

**Status: Done.** Part of [07 · Testing](../README.md) in the [Fetchline SaaS plan](../../README.md).

Unit tests were added on 2026-10-24 (see the update below). End-to-end coverage is in [integration-testing](../integration-testing/README.md).

## Original plan: add with `node:test` (built in, no dependencies)
| Unit | Cases |
|---|---|
| `parseContentRange`, `fileNameFromResponse`, `sanitizeFileName` (`engine/net.ts`) | RFC 5987 `filename*`, reserved names, a total of `*` |
| `parsePlaylist` (`engine/hls.ts`) | Master with audio group, encrypted, live, byte-range, relative URIs |
| `TokenBucket` (`engine/limiter.ts`) | Rate held over 2 s with 8 concurrent takers |
| `pickWork` splitting (`engine/download.ts`) | Never splits below 128 KB; orphaned segments are picked first |
| `classify` (`extension/background.js`) | Skips `range=` chunks, `.ts`/`.m4s`, small files |

## Update (2026-10-24)
- [`tests/engine.test.ts`](../../../tests/engine.test.ts) holds 12 `node:test` tests; run them with `npm test`:
  - byte-range parsing, RFC 5987 filenames, file-name sanitising (Windows device names)
  - HLS master, media, encrypted, live and byte-range playlists
  - token bucket shared by 8 takers
  - dynamic segmentation: orphans first, minimum split size, split relative to progress
  - Netscape cookie file
  - recovering the emoji file name from its `[id]` tag
  - manager validation and the header allow-list
- **Still uncovered:** `classify()` in the extension (it needs a `chrome` stub).
