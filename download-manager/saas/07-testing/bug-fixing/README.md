# Bug fixing

**Status: Ongoing.** Part of [07 · Testing](../README.md) in the [Harbor SaaS plan](../../README.md).

## Fixed during development (2026-10-23)
| Bug | Fix |
|---|---|
| The last MB downloaded on a single slow connection | Split floor lowered from 512 KB to 128 KB; the public run went from 48.6 s to 38 s |
| The tray kept running after the engine stopped (`Application.Exit()` did not end the message loop) | Run with an `ApplicationContext` and call `ExitThread()` |
| The extension showed "not running" on a cold start | Ping timeout raised from 800 ms to 1.5 s |
| A restarted `start.bat` couldn't bind because an old instance held port 8765 | `engine/main.ts` claims the port: it detects a running copy and asks an older one to exit cleanly |
| The test sometimes configured the wrong extension's service worker | It now selects the worker by manifest name |

## Open
- Track new bugs in GitHub Issues with labels `bug`, `site-compat` and `regression`. Every fix should come with a check in `scripts/`.
