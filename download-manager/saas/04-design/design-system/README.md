# Design system

**Status: Done.** Part of [04 · Design](../README.md) in the [Harbor SaaS plan](../../README.md).

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

## Update (2026-10-24): one shared token file
- **Single source of truth:** [`ui/tokens.css`](../../../ui/tokens.css) holds every color, typography and shape token (iOS/macOS system palette, light + dark + auto). `ui/index.html` links it before `ui/style.css`, which now holds only component rules.
- **Extension:** `extension/popup.html` and the overlay style in `extension/content.js` mirror the subset they need (they run in other pages and can't link the file); `tokens.css` documents this so they stay in step.
- **Tokens:** accents `--tint`/`--green`/`--orange`/`--red`/`--teal`/`--indigo`/`--purple`; surfaces `--bg`/`--surface`/`--glass`; text `--label`/`--label-2`/`--label-3`; lines/fills `--sep`/`--fill`; radii `--r-sm`/`--r`/`--r-lg`; shadows `--shadow`/`--sheet-shadow`.
- Verified the app still renders after the split (store screenshot below).
