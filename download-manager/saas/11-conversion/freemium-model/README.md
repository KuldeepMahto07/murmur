# Freemium model

**Status: In progress.** Part of [11 · Conversion](../README.md) in the [Fetchline SaaS plan](../../README.md).

| Free (forever) | Pro |
|---|---|
| Segmented engine, up to 8 connections | Up to 32 connections, per-site connection rules |
| Pause, resume and crash recovery | Same |
| SHA-256 and MD5 verification | Same, plus a batch check against checksum files |
| One queue, categories, global speed limit | Multiple and sync queues, scheduler actions (shutdown, run a program), download quotas |
| Video button: files and clear HLS | Same, plus batch-add every media item on a page |
| Hand-off to AB DM | Same |
| — | Site grabber, proxy/SOCKS/NTLM, CLI and protocol handler, priority support |

**Principle:** speed and reliability stay free. That's the trust builder. Power-user automation is what people pay for.

## Update (2026-10-24): gating implemented in the engine
| Feature | Free | Pro | Where it's enforced |
|---|---|---|---|
| Connections per download | up to 8 | up to 32 | `Manager.maxConnections()`: add, edit, settings, and every download start (a lapsed licence caps existing downloads at 8) |
| Scheduler completion actions (shut down the PC, close Fetchline) | — | ✅ | `updateSettings()` refuses them on Free; `whenQueueDone()` skips them if the licence lapsed |
| Speed, resume, crash recovery, SHA-256, queue, scheduler times, video button, HLS, yt-dlp, AB DM hand-off | ✅ | ✅ | never gated |

Planned Pro items will use the same `licensing.pro` check when they're built: multiple and sync queues, quotas, batch-add, proxy, CLI and per-site rules.
