# Frontend

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Clarion SaaS plan](../../README.md).

**Code lives in:** `upscaler/frontend/` (React 18 + Vite)
- `src/App.jsx`: layout, queue, settings panel, upload (button + drag-and-drop), polling every 800 ms while jobs run
- `src/Compare.jsx`: image wipe/zoom and synced video wipe/side-by-side
- `src/api.js`: fetch wrappers for `/api/*`
- `src/styles.css`: theme and components
- Build: `npm run build` → `frontend/dist`, served by FastAPI

**Missing:** routing, auth screens, credits display, TypeScript, component tests, and an i18n setup.
