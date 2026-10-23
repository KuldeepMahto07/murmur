# Monitoring

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
