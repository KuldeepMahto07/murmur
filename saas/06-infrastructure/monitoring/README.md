# Monitoring

**Status: Partial: logging only.** Part of [06 · Infrastructure](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:** Python `logging` to stdout (`data/server.log` when started with redirection). Job errors are stored in `Job.error` and shown in the library.

**Missing:**
- Local: a `GET /api/health` endpoint (GPU found? models cached? disk space?) and a "Diagnostics" panel. This is the most useful support tool for a desktop product.
- Opt-in crash reports only (e.g. Sentry with the audio and transcript **never** attached). The privacy promise rules out silent telemetry.
- Demo site: Vercel Analytics (privacy-friendly, no cookies) to measure [02-validation](../../02-validation/) traffic.
