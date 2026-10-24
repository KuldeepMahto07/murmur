# Design system

**Status: Partial.** Part of [04 · Design](../README.md) in the [Harbor SaaS plan](../../README.md).

## Tokens (in `ui/style.css`)
| Token | Dark | Light |
|---|---|---|
| `--bg` | #0f1218 | #f4f6fa |
| `--panel` | #161b24 | #ffffff |
| `--accent` → `--accent-2` | #2dd4bf → #6366f1 | same |
| `--ok` / `--warn` / `--bad` | #34d399 / #fbbf24 / #f87171 | same |

- **Typography:** system-ui / Segoe UI, 13 px base.
- **Shape:** 7–12 px corner radius.
- **Components:** primary button (gradient), ghost button, progress bar, segment map (canvas), status text colours, dialog, toast.
- **Overlay:** the extension overlay repeats the palette inside its shadow DOM (`extension/content.js`).

## Missing
- A single shared token file. The UI, the overlay and the popup each copy the colours today.
- Written component docs.
