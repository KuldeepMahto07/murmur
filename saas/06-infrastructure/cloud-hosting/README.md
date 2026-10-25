# Cloud hosting

**Status: Partial: Vercel demo live, not connected to the repo.** Part of [06 · Infrastructure](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:**
- **Vercel** project `murmur` (account `kuldeep1702k-1553`) hosts `frontend/` as a static demo: https://murmur-alpha-three.vercel.app. Deployed with `cd frontend && npx vercel deploy --prod`. It is **not** connected to the GitHub repo.
- The backend runs on the user's PC only (GTX 1650 Ti, CUDA 12.8 build of torch).

**Options for a reachable backend (only if the strategy needs it; local-first is the product):**
| Option | Cost | Notes |
|---|---|---|
| Home PC + Cloudflare Tunnel | Free | PC must be on. Needs auth first ([05/authentication](../../05-development/authentication/)) |
| Modal / RunPod serverless GPU | about $0.50–1 per GPU-hour | Needs object storage (S3/R2) for media and transcripts, and a Postgres for jobs |
| Hetzner / Lambda GPU box | about $100–400/mo | For the team-server SKU demo |

**Next:** connect Vercel to GitHub (Project → Settings → Git) so `main` auto-deploys the demo.
