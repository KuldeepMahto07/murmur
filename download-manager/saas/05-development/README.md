# 05 · Development

**Status: done.** Back to the [overview](../README.md).

| Sub-item | Status | Summary |
|---|---|---|
| [Frontend](frontend/) | Done (MVP) | Code lives in `download-manager/ui/`. It was not moved, so the engine still serves it as is. |
| [Backend](backend/) | Done (MVP) | Code lives in `download-manager/engine/`. Run it with `node engine/main.ts` or `start.bat`. |
| [APIs](apis/) | Done (MVP) | Code lives in `engine/server.ts`. It binds to loopback only, on port 8765 by default. |
| [Database](database/) | Done (MVP) | There is no database server. State is file-based, which suits a single-user desktop app: |
| [Authentication](authentication/) | Done | Licence keys + 14-day trial, and opt-in browser pairing (token) — done |
| [Integrations](integrations/) | Done | Missing: a Firefox build (MV3 differences in `webRequest` and the background script) and an Opera listing. |
