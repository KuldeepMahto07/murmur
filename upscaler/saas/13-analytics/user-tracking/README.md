# User tracking

**Status: Not started (plan written).** Part of [13 · Analytics](../README.md) in the [Clarion SaaS plan](../../README.md).

**Events.** Local app: opt-in and anonymous. Cloud: always on.
- `app_open`
- `file_added` (kind, input_res, duration)
- `render_started` (preset, scale/target, fps, faces, codec, preview)
- `render_finished` (gpu_seconds, wall_seconds, frames, success, fp32_fallback)
- `compare_viewed`
- `download_clicked`
- `upsell_shown` / `upsell_clicked`
- `checkout_started` / `checkout_completed`

**Tooling:** PostHog (self-hostable, EU option). No media and no file names are sent.
