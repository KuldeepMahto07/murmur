# Unit testing

**Status: Not started.** Part of [07 · Testing](../README.md) in the [Fetchline SaaS plan](../../README.md).

There are no unit tests yet. All coverage today is end-to-end (see [integration-testing](../integration-testing/README.md)).

## Add with `node:test` (built in, no dependencies)
| Unit | Cases |
|---|---|
| `parseContentRange`, `fileNameFromResponse`, `sanitizeFileName` (`engine/net.ts`) | RFC 5987 `filename*`, reserved names, a total of `*` |
| `parsePlaylist` (`engine/hls.ts`) | Master with audio group, encrypted, live, byte-range, relative URIs |
| `TokenBucket` (`engine/limiter.ts`) | Rate held over 2 s with 8 concurrent takers |
| `pickWork` splitting (`engine/download.ts`) | Never splits below 128 KB; orphaned segments are picked first |
| `classify` (`extension/background.js`) | Skips `range=` chunks, `.ts`/`.m4s`, small files |
