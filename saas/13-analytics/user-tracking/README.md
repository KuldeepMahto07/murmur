# User tracking

**Website (Vercel demo / landing):** Vercel Web Analytics or Plausible. Cookie-free, so no consent banner is needed.

**App (opt-in at first run, off by default, with a clear explanation):**
| Event | Properties (never file names, text or audio) |
|---|---|
| `app_installed` | version, OS, GPU present (bool), VRAM bucket |
| `transcript_completed` | mode, duration bucket (<10m, 10–60m, >60m), diarize (bool), method, real-time-factor bucket |
| `export_downloaded` | format |
| `translation_run` | target language |
| `pro_gate_hit` | gate (length, precise, batch, summaries) |
| `upgrade_clicked` / `license_activated` | plan |
| `error` | stage, error class (no message text) |

Send in a daily batch to a small endpoint (Cloudflare Worker + D1). Add a "show me what's sent" button in Settings.
