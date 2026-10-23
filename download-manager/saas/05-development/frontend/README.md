# Frontend

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

**Code lives in [`download-manager/ui/`](../../../ui/). It was not moved, so the engine still serves it as is.**

| File | What it is |
|---|---|
| [`ui/index.html`](../../../ui/index.html) | Layout: top bar, sidebar, list, details pane, dialogs |
| [`ui/app.js`](../../../ui/app.js) | State over SSE (`/api/events`), rendering, actions, add/settings dialogs, segment map |
| [`ui/style.css`](../../../ui/style.css) | Themes and design tokens |
| [`ui/logo.svg`](../../../ui/logo.svg) | Logo |

The extension's UI (popup and video overlay) is in [`extension/`](../../../extension/). See [integrations](../integrations/README.md).

**Missing:** the desktop shell (tray, notifications), a first-run screen, and localisation.
