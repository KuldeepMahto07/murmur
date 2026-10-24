# MVP scope

**Status: Done.** Part of [03 · Planning](../README.md) in the [Harbor SaaS plan](../../README.md).

The MVP scope was approved on 2026-10-23 and has been delivered:
- **Engine:** segmented HTTP(S) with dynamic splitting, keep-alive reuse, retries and backoff, and fallback to one connection.
- **Resume:** pause and resume, crash recovery from fsynced checkpoints, and a re-check of 16 KB of overlap on resume.
- **Integrity:** SHA-256 and MD5, plus an optional expected-hash check.
- **Organisation:** a queue with a concurrency limit, categories by file type, global and per-download speed limits, and a daily scheduler.
- **UI:** a local web interface with a details pane and a segment map.
- **Added after the MVP:** the MV3 extension with the video button, HLS downloading and the AB DM hand-off.

Details: [docs/plan.md](../../../docs/plan.md).
