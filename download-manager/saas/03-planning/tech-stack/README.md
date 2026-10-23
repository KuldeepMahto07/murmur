# Tech stack

**Status: Done.** Part of [03 · Planning](../README.md) in the [Fetchline SaaS plan](../../README.md).

| Layer | Choice | Why |
|---|---|---|
| Engine | Node.js 24 with TypeScript, run through type stripping; no npm dependencies | No build step, nothing to install here; Rust and Go weren't available |
| UI | Vanilla HTML/CSS/JS served by the engine, with live updates over SSE | Zero tooling; can later be wrapped in Electron or Tauri |
| Extension | Manifest V3, plain JS | Store-ready for Chrome and Edge |
| Media | ffmpeg (`-c copy` remux) for HLS → MP4 | Standard and fast; optional |
| State | JSON with atomic write and fsync, plus sparse `.part` files | Simple and crash-safe |

**Planned change:** for distribution, package the engine and UI with a desktop shell. The options:
- Electron: fastest, but about 100 MB.
- Tauri with a Node sidecar: small, but needs a Rust toolchain.
- A Node single-executable application (SEA) plus a tray helper.

Decide in [development-plan](../development-plan/README.md).
