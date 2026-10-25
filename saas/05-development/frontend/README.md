# Frontend → `frontend/`

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Murmur SaaS plan](../../README.md).

| File | What it does |
|---|---|
| [`frontend/src/App.tsx`](../../../frontend/src/App.tsx) | Hash router (`#/`, `#/library`, `#/t/<id>`), top bar, demo banner |
| [`frontend/src/UploadPage.tsx`](../../../frontend/src/UploadPage.tsx) | Drop zone, URL tab, options, upload with progress |
| [`frontend/src/LibraryPage.tsx`](../../../frontend/src/LibraryPage.tsx) | Job table, polling, bulk export/delete, retry |
| [`frontend/src/TranscriptPage.tsx`](../../../frontend/src/TranscriptPage.tsx) | Player sync, search, edit, speaker panel, export & translate panels |
| [`frontend/src/api.ts`](../../../frontend/src/api.ts) | Typed API client, `VITE_API_URL`, demo-mode fallbacks |
| [`frontend/src/demo.ts`](../../../frontend/src/demo.ts) | Bundled sample job/transcripts for the static demo |
| [`frontend/src/styles.css`](../../../frontend/src/styles.css) | All styling (see [04-design/design-system](../../04-design/design-system/)) |

**Build:** `cd frontend && npm run build` → `frontend/dist` (served by FastAPI locally and by Vercel).
**Missing:** no component tests, no state library (fine for now), no i18n of the UI itself.
