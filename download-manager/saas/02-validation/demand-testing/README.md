# Demand testing

**Status: In progress.** Part of [02 · Validation](../README.md) in the [Harbor SaaS plan](../../README.md).

## What we have learned already (from building)
- **Speed:** the technical value is real. 8 connections reached about 5.6 MB/s against 2.5 MB/s on one connection, measured with the public kernel tarball.
- **YouTube:** the first real user test (2026-10-23) went straight to YouTube Shorts, which Harbor deliberately doesn't support. This is the biggest demand risk, and it has to be stated on the landing page and the store listing.

## Next tests
- **Ad-free search test:** Google Trends and keyword volume for "idm alternative", "download manager for chrome" and "download accelerator". Compare them against "youtube downloader" to size the market we are choosing to give up.
- **Store-search test:** publish the extension as an unlisted beta and watch installs from a single Reddit post.
