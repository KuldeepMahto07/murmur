# Frontend

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Harbor SaaS plan](../../README.md).

**Code lives in [`download-manager/ui/`](../../../ui/). It was not moved, so the engine still serves it as is.**

| File | What it is |
|---|---|
| [`ui/index.html`](../../../ui/index.html) | Layout: top bar, sidebar, list, details pane, dialogs |
| [`ui/app.js`](../../../ui/app.js) | State over SSE (`/api/events`), rendering, actions, add/settings dialogs, segment map |
| [`ui/style.css`](../../../ui/style.css) | Themes and design tokens |
| [`ui/logo.svg`](../../../ui/logo.svg) | Logo |

The extension's UI (popup and video overlay) is in [`extension/`](../../../extension/). See [integrations](../integrations/README.md).

**Desktop shell (interim, Windows):** [`desktop/tray.ps1`](../../../desktop/tray.ps1), started by [`desktop/Harbor.vbs`](../../../desktop/Harbor.vbs).
- PowerShell and WinForms, with no extra installs.
- Runs the engine hidden; a tray icon menu (open, queue, pause all, start with Windows, quit); notifications when downloads finish or fail; one tray per port.
- Verified by [`scripts/verify-tray.ps1`](../../../scripts/verify-tray.ps1).

**Missing:** a first-run screen, localisation, and a packaged shell (Electron or a Node single-executable build) for the installer.
