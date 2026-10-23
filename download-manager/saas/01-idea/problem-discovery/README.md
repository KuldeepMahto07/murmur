# Problem discovery

**Status: Done.** Part of [01 · Idea](../README.md) in the [Fetchline SaaS plan](../../README.md).

## The problem
Big downloads in a browser are fragile and slow. Users run into four problems:
- **Single connection.** A server or CDN that throttles each connection caps the speed (we measured about 2.5 MB/s on one connection to cdn.kernel.org).
- **No real resume.** A dropped Wi-Fi link, a sleeping laptop or a browser crash means starting a multi-GB file over.
- **No organisation.** Everything lands in one Downloads folder, with no queue, no schedule and no speed cap that keeps calls usable.
- **Hard-to-save page videos.** Video on ordinary sites (courses, news, self-hosted players) is hard to save even when the site serves it openly as MP4 or HLS.

## Evidence
- **IDM's market.** IDM has sold a paid fix for exactly these problems since 1999. Its own FAQ is full of resume, "stuck at 99%" and capture questions. See [competitor-analysis](../competitor-analysis/README.md).
- **Our measurements.** On the 140 MB kernel tarball, 8 connections reached about 5.6 MB/s against 2.5 MB/s on one ([verify results](../../../README.md#verify)).
- **Open-source demand.** AB Download Manager reached about 18.7k GitHub stars (checked 2026-10-23), which shows people still want a modern IDM-style tool.

## Who feels it most
1. People in South Asia, Africa, MENA and LATAM whose connections are unstable or throttled per connection. This is IDM's historic stronghold.
2. Students and professionals downloading large course videos, ISOs, datasets and game mods.
3. Anyone on metered or fair-use links who needs scheduling and a speed cap.
