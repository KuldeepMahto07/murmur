# Harbor: plan and MVP status

Harbor is an original segmented download manager built from the public-docs study in [idm-analysis.md](../saas/01-idea/competitor-analysis/idm-analysis.md). It shares no code, name, artwork or text with IDM.

## Approved stack (2026-10-23)

- **Engine:** Node.js 24, TypeScript run directly through Node's type stripping, with no npm dependencies. It uses `node:http/https` keep-alive agents, positional `FileHandle` writes and `crypto`.
- **UI:** a static vanilla JS/CSS app served by the engine on `127.0.0.1:8765`. It gets live state over Server-Sent Events and sends commands through a small JSON API.
- **Later:**
  - Wrap the UI in Electron or Tauri for a tray icon and native dialogs.
  - Add an MV3 extension that hands downloads to the engine through a native messaging host.
- **Why not Rust or Go:** neither toolchain is installed here, and the user chose not to install one for the MVP. The engine's design (segments, checkpoints, the resume check) ports directly if we move later.

## Engine design

| Concern | Implementation (`engine/download.ts`) |
|---|---|
| Probe | The first request is `GET Range: bytes=0-`. A 206 with `Content-Range` means the file is resumable and gives its size; a 200 means one connection with no resume. This saves the separate HEAD request. |
| Dynamic segmentation | Up to N workers. A free worker first takes an orphaned segment. Otherwise it halves the segment with the most bytes left, if each half is ≥ 128 KB, and fetches the second half. The owner of the shortened segment sees the new end and stops there. |
| Connection reuse | Each segment is requested as a closed range, so a socket that finishes its range cleanly goes back to the keep-alive pool for the next piece. |
| Storage | One sparse `.fetchline-<id>.part` file pre-sized to the full length and written at absolute offsets. It sits in the destination folder, so finishing is just a rename (no rebuild step). |
| Crash safety | Every 1 s: snapshot the positions, `fdatasync` the part file, then write `state.json` atomically (tmp + fsync + rename). Only positions that were synced are ever persisted. On startup, downloads that were running restart automatically. |
| Resume check | When resuming a segment, the request starts 16 KB before the saved position and those bytes are compared with the disk. On a mismatch the segment is re-fetched from its start. A second mismatch, or a 200 or `If-Range` failure, restarts the download on one connection. |
| Validators | `ETag` / `Last-Modified` are sent as `If-Range`. A changed `Content-Range` total counts as the file having changed. |
| Retries | Each connection retries with exponential backoff (1 s up to 30 s), at most 6 times. 4xx errors are fatal, except 408 and 429. Other connections pick up the segment of a connection that gave up. |
| Speed limit | Token buckets that allow debt: one global (total) and one per download, both live-adjustable. |
| Checksums | SHA-256 and MD5 are always computed when a download finishes. An optional expected `sha256:` or `md5:` value is compared, and a mismatch marks the download as an error. |
| Queue | Items marked `inQueue` are started up to `maxConcurrent`. Manual starts bypass the limit. |
| Scheduler | Daily start and stop times. When a queue the scheduler started finishes, it can do nothing, exit, or shut down the PC with a 60 s warning (`shutdown /a` cancels). |
| Categories | Chosen by extension, first from the URL and then from the server's file name. Each category has its own folder. |
| API safety | Binds to loopback only. Mutating calls need the `X-Fetchline: 1` header, which forces a CORS preflight that is never granted. The `Host` header must be a loopback address, which blocks DNS rebinding. |

## Verification (`node scripts/verify.ts`)

The script runs the engine as a child process and drives it over HTTP:

1. Start a download with 8 connections and check that ranges are honoured.
2. Pause at 20%. Check that no connections stay open and the byte count stays the same. Then resume.
3. Check that at least N connections run in parallel and that dynamic splitting produced more than one segment.
4. Hard-kill the process (`TerminateProcess`). Check that `state.json` kept the synced progress.
5. Local phase only: overwrite 64 bytes just before a saved position on disk.
6. Restart the engine. Check that the download resumes by itself from where it was, not from zero.
7. Wait for completion. Check that the engine's SHA-256 matches the expected value, and that an independent SHA-256 of the file matches too.
8. Local phase only: check that the log shows the resume check caught the corruption.

There are two phases:

- **Local:** a 48 MB deterministic file served by an in-process range server, throttled per connection.
- **Public:** `linux-6.6.tar.xz` (140 MB) from cdn.kernel.org, checked against the SHA-256 published in `sha256sums.asc`.

Results are in the README.

## Browser extension and media button (built 2026-10-23)

- **Handoff:** the extension calls the engine's loopback API directly (`fetch` from the service worker, which has host permission for `127.0.0.1`).
  - We chose this over native messaging because it needs no registry entry or helper executable.
  - The API's existing `X-Fetchline` header and loopback `Host` checks still block web pages.
- **Media sniffing** uses `webRequest.onHeadersReceived` on media, XHR and other requests:
  - Captured: `video/*` and `audio/*` responses, media file extensions, and HLS playlists (`mpegurl` type or `.m3u8`).
  - Ignored: stream chunks (`.ts`, `.m4s`, DASH `.mpd`, URLs with a `range=` parameter) and files under 64 KB.
- **Playlists** are probed through the engine (`POST /api/media/probe`):
  - A master playlist is shown as its list of qualities, and its child playlists are hidden.
  - Encrypted or live playlists are shown as blocked.
- **Overlay:** a closed shadow root sitting at the top of the page. It hit-tests the pointer against video geometry, because players usually cover the `<video>` with their own controls. A video with `mediaKeys` (EME/DRM) gets a "protected" note instead of a list.
- **Engine HLS** (`engine/hls.ts`):
  - Picks the chosen quality and its separate audio track, if any.
  - Downloads segments in parallel. Each segment is fsynced and renamed when complete, so a resume skips finished segments.
  - Joins the segments per track, then runs `ffmpeg -c copy` to produce an MP4 (merging the separate audio).
  - Without ffmpeg it saves the joined `.ts`.
  - Refuses: `EXT-X-KEY` other than `NONE`, live playlists, and byte-range playlists.

## Next (post-MVP)

1. Clipboard watcher. Today, pasting into the UI works.
2. Several named queues and sync queues, plus a download quota.
3. Proxy (HTTP CONNECT and SOCKS5) and a per-site credentials store.
4. Site grabber with depth, domain and type filters.
5. Desktop shell: tray icon, notifications and "open folder".
