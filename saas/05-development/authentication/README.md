# Authentication

**Built: nothing, on purpose.** Murmur binds to `127.0.0.1` and is single-user, so the local machine is the security boundary. The Vercel demo has no server to authenticate against.

**Needed when:**
1. **The backend is exposed beyond localhost** (a tunnel or `VITE_API_URL`). Minimum is a shared access token (`MURMUR_ACCESS_TOKEN`) checked by middleware, plus a login screen that stores it in `localStorage`. Without this, anyone with the URL can use the GPU and read the transcripts.
2. **Pro license:** offline-verifiable signed license keys (Ed25519 public key in the app). No accounts needed.
3. **Team server (v1.0):** user accounts (argon2 password hashes), sessions, roles (admin/member), per-user libraries, audit log, then SSO (OIDC) for institutions.
