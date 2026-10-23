# CI/CD

**Status: Not started.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

## GitHub Actions plan (`.github/workflows/` at the repo root, scoped to `download-manager/**`)
| Job | Runs | Notes |
|---|---|---|
| test-engine | `node scripts/verify.ts --local` | Offline and deterministic, about 15 s |
| test-extension | `node scripts/verify-extension.ts` | Needs Chrome/Edge and ffmpeg on `windows-latest` |
| public-smoke (nightly) | `node scripts/verify.ts --public` | Downloads 140 MB from cdn.kernel.org, so nightly only |
| release (on tag) | Build, sign, attach to the release, open the winget PR | Needs signing secrets |

The repo also holds other projects (Murmur, upscaler), so use path filters so they don't trigger each other.
