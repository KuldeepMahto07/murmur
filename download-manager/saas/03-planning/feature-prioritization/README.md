# Feature prioritization

**Status: Done.** Part of [03 · Planning](../README.md) in the [Harbor SaaS plan](../../README.md).

Scored with RICE (Reach × Impact × Confidence ÷ Effort) for the next release:

| Feature | R | I | C | E (weeks) | Score | Decision |
|---|---|---|---|---|---|---|
| Desktop shell (tray, notifications, auto-start) | 10 | 3 | 0.9 | 2 | 13.5 | **Next** |
| Code-signed installer + winget | 10 | 3 | 0.8 | 1.5 | 16 | **Next** |
| Clipboard watcher | 6 | 1 | 0.9 | 0.5 | 10.8 | Next |
| Multiple / sync queues | 4 | 2 | 0.8 | 1.5 | 4.3 | Pro |
| Site grabber | 2 | 2 | 0.6 | 3 | 0.8 | Pro, later |
| Proxy / SOCKS / NTLM | 3 | 2 | 0.7 | 2 | 2.1 | Pro |
| FTP | 1 | 1 | 0.9 | 1 | 0.9 | Backlog |
| YouTube, Instagram and similar via yt-dlp | 9 | 3 | 0.9 | 1 | 24.3 | ✅ **Built 2026-10-23 at the owner's request** (direct build only; not in store builds) |
| DRM extraction (Netflix, Widevine, PlayReady…) | — | — | — | — | — | **Never** |

**Why yt-dlp and not our own extractors:**
- yt-dlp is maintained upstream and already tracks site changes, so we don't take on that patching work ourselves.
- It's an external program the user installs, and Harbor only runs it.

**Risks we accept:**
- the platforms' terms of service (the user is responsible for what they download)
- store rejection, which is why there's a separate store build
- breakage until yt-dlp updates; tell users to run `winget upgrade yt-dlp.yt-dlp`
