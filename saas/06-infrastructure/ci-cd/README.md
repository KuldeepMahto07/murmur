# CI / CD

**Status: Not started (plan written).** Part of [06 · Infrastructure](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:** nothing automated. The Vercel deploy is manual.

**Plan (GitHub Actions):**
1. `frontend.yml`: on push/PR touching `frontend/**`: `npm ci && npm run build` (type-check + bundle).
2. `backend.yml`: Windows + Ubuntu runners, CPU only: install with `MURMUR_DEVICE=cpu`, run `pytest` (unit tests for `exports.py`, `pipeline.assign_speakers`, API routes with a stub worker). Cache `~/.cache/huggingface` and use the `base` model plus a 5 s fixture for one smoke transcription.
3. `deploy-demo.yml`: on `main`, or by connecting Vercel's Git integration instead (simpler).
4. `release.yml`: on tag `v*`, build the Windows installer and attach it to a GitHub Release.
