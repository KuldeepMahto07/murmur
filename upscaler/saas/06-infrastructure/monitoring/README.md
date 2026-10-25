# Monitoring

**Status: Not started (plan written).** Part of [06 · Infrastructure](../README.md) in the [Clarion SaaS plan](../../README.md).

**Today:** job messages only (frame count, fps, ETA), shown in the UI.

**For the cloud:**
- Sentry for exceptions
- Prometheus/Grafana or Modal metrics, tracking:
  - queue depth
  - GPU-seconds per job
  - per-frame latency per model and resolution
  - fp32-fallback rate
  - OOM retries
  - encode failures
- **Alerts:** queue wait > 10 min, error rate > 2%, and cost per output minute above the pricing assumption
