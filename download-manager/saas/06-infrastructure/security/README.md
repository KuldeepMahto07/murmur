# Security

**Status: Partial.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Done
- **Loopback API:** binds to 127.0.0.1 only, with the `X-Fetchline` header and loopback `Host` checks, so websites cannot drive the engine (`engine/server.ts`).
- **File names:** sanitized, with Windows reserved names blocked (`engine/net.ts`). Static serving guards against path traversal.
- **Headers:** only an allow-list of headers is accepted from the extension (cookie, referer, user-agent, origin, authorization, accept-language).
- **Extension overlay:** a closed shadow DOM, so pages can't read or alter it.
- **No DRM or encryption bypass** anywhere.

## To do
- An extension-to-engine pairing token.
- Cookies are kept in `data/state.json` to allow resume. Encrypt that file at rest with DPAPI, or drop cookies once a download completes.
- Code signing ([devops](../devops/README.md)), dependency-free supply chain (keep it), and a `SECURITY.md`.

## Update (2026-10-24)
- Privacy policy drafted: [`site/privacy.html`](../../../site/privacy.html). Its main promise: URLs, files and cookies never leave the PC, and telemetry would be opt-in only.
