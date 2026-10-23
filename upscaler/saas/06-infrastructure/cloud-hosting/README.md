# Cloud hosting

**Today:** local only (`start.bat` → 127.0.0.1:8001).

**Cloud plan**
- **Web/API:** a small CPU container (Fly.io/Render/Railway) running FastAPI, plus Postgres (Neon/Supabase) and Cloudflare R2.
- **GPU workers:** a container image with torch + spandrel + ffmpeg + weights baked in, pulling jobs from a queue.
  - **Start:** serverless GPU (Modal or RunPod Serverless) to pay per second and scale to zero.
  - **Later:** reserved RTX 4090 / L4 pods once utilisation passes ~40%.
- Per-minute cost estimates are in [pricing strategy](../../11-conversion/pricing-strategy/README.md).
- **Egress:** R2 has no egress fees, which matters because 4K60 outputs are about 32 Mbps (a 15 s clip is 60 MB).
