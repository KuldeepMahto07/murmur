# Free trial

**Status: Done.** Part of [11 · Conversion](../README.md) in the [Harbor SaaS plan](../../README.md).

- **Model:** the free tier is permanent. Pro features unlock for a **14-day trial** with no card.
- **When it ends:** Pro features go back to free limits. Nothing is deleted and no download is interrupted.
- **Reminders:** in-app only (no email capture needed) on day 10 and day 14, showing what Pro did for them ("3 scheduled queues ran, 2 quota-limited nights").
- **No dark patterns:** don't block downloads and don't nag more than once a day. The trial also stays honest about what it is, with no fake countdowns.

## Update (2026-10-24)
- **Built:** Settings → Harbor Pro → *Start 14-day free trial*. No card or account, once per PC, stored in `data/license.json`.
- When the trial ends, Pro features revert to the Free limits and nothing is interrupted: active downloads continue with up to 8 connections.
- There are no in-app reminders yet. Day-10 and day-14 notices are still to do.
