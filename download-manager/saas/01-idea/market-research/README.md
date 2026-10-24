# Market research

**Status: Done.** Part of [01 · Idea](../README.md) in the [Harbor SaaS plan](../../README.md).

## Market snapshot (desktop download managers)
- **Paid incumbent:** IDM, Windows only, priced at $11.95/year or $24.95 lifetime for 1 PC (secure.internetdownloadmanager.com, checked 2026-10-23).
- **Free and open-source alternatives:** AB Download Manager (Kotlin, Apache-2.0, very active), XDM, Motrix (aria2 plus Electron), Persepolis, Gopeed and JDownloader. Free Download Manager is free but closed source.
- **Distribution channels:** the Chrome Web Store and Edge Add-ons for the extension; winget, Scoop, the Microsoft Store and GitHub Releases for the app.

## Market forces
- **Browsers keep tightening extension rules.** Manifest V3 and Chrome policy forbid facilitating unauthorized downloads of copyrighted media. Tools that market "YouTube download" get removed from the store. A clean, policy-safe positioning is an advantage.
- **Price anchor.** Users already accept paying about $25 for a lifetime IDM licence. Open-source rivals push the floor to $0 for basic features.
- **Platform gap.** IDM is Windows-only, so a cross-platform engine is an opening later. Today Harbor runs anywhere Node 24 does, but it ships Windows-first.

## Open questions (to validate in 02)
- What share of IDM users mainly use it for YouTube, which we will not support?
- How many users would pay for a polished, honest, open-core alternative?
