# Design system

**Status: Done (implicit tokens in styles.css).** Part of [04 · Design](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built (implicit, in `frontend/src/styles.css`):**
| Token | Value |
|---|---|
| `--ink` / `--ink-2` / `--muted` | `#1f1d2b` / `#4a4759` / `#8a8696` |
| `--paper` / `--card` / `--line` | `#f6f3ec` / `#fffdf8` / `#e6e0d4` |
| `--accent` / `--accent-2` / `--danger` | `#e8603c` / `#2f8f83` / `#c0392b` |
| `--radius` | 14px (cards), 10px (controls), 999px (pills) |
| Type | `--serif` (headings, transcript), `--sans` (UI) |

Components: `.card`, `.primary`, `.primary.big`, `.link`, `.text` input, `.pill.{done,running,failed}`, `.banner.{error,info}`, `.toggle`, `.mode`, `.tabs`, `.bar` progress.

**Missing:** a component inventory page (`#/styleguide`), spacing scale tokens, dark-mode token set, and documented do's and don'ts. Do this before the installer UI adds new screens.
