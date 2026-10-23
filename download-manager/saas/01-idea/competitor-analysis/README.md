# Competitor analysis

**Status: Done.** Part of [01 · Idea](../README.md) in the [Fetchline SaaS plan](../../README.md).

- **IDM deep dive:** [idm-analysis.md](idm-analysis.md), a feature and architecture study built from IDM's public site and docs only. It was moved here from `docs/`.

| | IDM | AB Download Manager | Free Download Manager | Fetchline (today) |
|---|---|---|---|---|
| Price | $24.95 lifetime / $11.95 a year | Free, open source | Free | Free MVP; Pro planned |
| Segmented and dynamic splitting | Yes | Yes | Yes | Yes (verified 8 connections) |
| Crash-safe resume | Yes | Yes | Yes | Yes, plus a re-check of 16 KB of overlap |
| Checksum verification | Not documented | Partial | Yes | SHA-256 and MD5 on every file |
| Video button on pages | Yes (includes YouTube) | Media capture | Yes | Yes, for files and clear HLS; DRM refused |
| Platforms | Windows | Windows, macOS, Linux, Android | Windows, macOS, Linux | Windows-first (Node) |
| Code signing and trust | Signed | Signed | Signed | **Unsigned (gap)** |

## Takeaways
1. **The features are table stakes.** The engine features are now commodities, so the winning angles are trust (open source, no adware), verification and polish.
2. **YouTube.** IDM's biggest pull is YouTube, which we won't match. Our messaging has to lead with speed, reliability and verification instead.
3. **AB DM.** It is free and strong. We position as complementary (the hand-off) and differentiate on the verification and the media button.
