# APIs

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

**Code lives in [`engine/server.ts`](../../../engine/server.ts).** It binds to loopback only, on port 8765 by default.

| Route | Purpose |
|---|---|
| `GET /api/state`, `GET /api/events` (SSE) | Snapshot and live updates for the UI |
| `GET /api/ping` | Health check, used by the extension |
| `POST /api/downloads` | Add (url, kind `file`/`hls`, variant, headers, checksum, start mode) |
| `POST /api/downloads/:id/{resume,pause,redownload}`, `PUT`, `DELETE` | Control a download |
| `POST /api/queue/{start,stop}`, `POST /api/pause-all`, `PUT /api/settings` | Queue and settings |
| `POST /api/media/probe` | List the qualities in an HLS playlist |
| `POST /api/shutdown` | Graceful exit |

**Safety:** changes need the `X-Fetchline: 1` header (which forces a CORS preflight that is never granted) and a loopback `Host` header (which blocks DNS rebinding).

**Outbound API:** AB Download Manager's `POST /add` and `/ping` on port 15151, called from the extension.

**Missing:** an OpenAPI file and a pairing token for extension-to-engine calls.
