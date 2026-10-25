# Security

**Status: Partial: localhost binding; no auth.** Part of [06 · Infrastructure](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:**
- Server binds to `127.0.0.1` only. CORS is off unless `MURMUR_CORS_ORIGINS` is set.
- File names are sanitised for downloads. Uploads go to per-job folders with a size cap (`MURMUR_MAX_UPLOAD_MB`).
- Secrets are only in `.env` (gitignored). Nothing secret is in the Vercel demo.

**Risks and missing pieces:**
- **No auth.** Exposing the port (tunnel or LAN) would expose all transcripts. Block or warn when `--host 0.0.0.0` is used without an access token.
- **yt-dlp on arbitrary URLs:** server-side requests to internal addresses (SSRF) if multi-user. Restrict to http(s) and public IPs for the team server.
- **Path traversal:** the SPA static route serves files under `frontend/dist` only. Add an explicit `resolve().is_relative_to()` check.
- **Dependency supply chain:** pin with hashes in the lockfile and run `pip-audit` / `npm audit` in CI.
- **Data at rest:** transcripts are plain JSON on disk. Offer optional encryption (Windows DPAPI) as a Pro or Team feature for legal users.
