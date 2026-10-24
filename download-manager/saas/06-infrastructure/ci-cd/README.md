# CI/CD

**Status: Ready (not yet run on GitHub).** Part of [06 · Infrastructure](../README.md) in the [Harbor SaaS plan](../../README.md).

## GitHub Actions plan (`.github/workflows/` at the repo root, scoped to `download-manager/**`)
| Job | Runs | Notes |
|---|---|---|
| test-engine | `node scripts/verify.ts --local` | Offline and deterministic, about 15 s |
| test-extension | `node scripts/verify-extension.ts` | Needs Chrome/Edge and ffmpeg on `windows-latest` |
| public-smoke (nightly) | `node scripts/verify.ts --public` | Downloads 140 MB from cdn.kernel.org, so nightly only |
| release (on tag) | Build, sign, attach to the release, open the winget PR | Needs signing secrets |

The repo also holds other projects (Murmur, upscaler), so use path filters so they don't trigger each other.

## Update (2026-10-24)
- [`.github/workflows/fetchline.yml`](../../../../.github/workflows/fetchline.yml) is at the repo root and path-filtered to `download-manager/**`. It runs on `windows-latest`:
  - unit tests
  - `verify.ts --local`, plus `verify.ts --public` nightly
  - the extension suite in headless Edge (ffmpeg via Chocolatey)
  - the store-build check
  - the tray suite
- **Next:** push, so it runs for the first time, then add a release job (sign → GitHub Release → winget PR).
