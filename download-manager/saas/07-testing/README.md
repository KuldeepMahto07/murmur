# 07 · Testing

**Status: in progress.** Back to the [overview](../README.md).

| Sub-item | Status | Summary |
|---|---|---|
| [Unit testing](unit-testing/) | Done | 12 `node:test` tests (`npm test`): parsing, HLS, rate limiter, segmentation, cookies, emoji file names, manager validation |
| [Integration testing](integration-testing/) | Done |  |
| [Bug fixing](bug-fixing/) | Ongoing | Track new bugs in GitHub Issues with labels `bug`, `site-compat` and `regression`. Every fix should come with a check in `scripts/`. |
| [Performance testing](performance-testing/) | Partial | Run a 1 GB+ file on a gigabit link, and record CPU and RAM use (the target is under 5% CPU at 50 MB/s). |
| [Beta testing](beta-testing/) | Not started | Who: 30 to 50 testers from the waitlist, mixing Windows 10 and 11, Chrome and Edge, and fast and slow connections. |
