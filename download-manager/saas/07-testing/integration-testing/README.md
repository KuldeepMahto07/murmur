# Integration testing

**Status: Done.** Part of [07 · Testing](../README.md) in the [Fetchline SaaS plan](../../README.md).

| Suite | Covers | Last result |
|---|---|---|
| `scripts/verify.ts --local` | 48 MB throttled range server: 8 connections, pause and resume, hard kill and restart, a deliberate corruption caught by the resume re-check, SHA-256 | ✅ all checks passed (2026-10-23) |
| `scripts/verify.ts --public` | 140 MB `linux-6.6.tar.xz` against its published SHA-256 | ✅ 38 s including pause, kill and restart |
| `scripts/verify-extension.ts` | Headless Edge with the unpacked extension: hover button, menu, MP4 + HLS 480p (separate audio) + 360p, encrypted playlist blocked, header hand-off | ✅ 3/3 runs |
| `… --real-abdm` | Same calls relayed to the installed AB Download Manager 1.11.1; real downloads checked | ✅ |
