# Performance testing

**Status: Partial.** Part of [07 · Testing](../README.md) in the [Harbor SaaS plan](../../README.md).

| Measure | Result |
|---|---|
| 1 connection, cdn.kernel.org | about 2.5 MB/s (curl) |
| 8 connections, same file | peak about 5.6 MB/s, about 4.5 MB/s sustained |
| Dynamic segmentation | 9 segments at 55%, 23 by the end (connections kept busy right to the finish) |
| Checkpoint cost | fsync plus state write every 1 s; no measurable stall at these speeds |

## To do
- Run a 1 GB+ file on a gigabit link, and record CPU and RAM use (the target is under 5% CPU at 50 MB/s).
- 20 queued downloads at once: is the UI's 500 ms SSE update still smooth?
- Compare head to head with IDM and AB DM on the same URL and machine.
