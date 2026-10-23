# Public release

**Status: Not started.** Part of [08 · Launch](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Go/no-go checklist
- [ ] Signed installer; winget manifest merged
- [ ] Chrome Web Store and Edge Add-ons listings approved (single-purpose description: "send downloads and openly served media to a desktop download manager")
- [ ] Store listing and landing page state the YouTube/DRM limits
- [ ] Update check working (`latest.json`)
- [ ] `verify.ts` and `verify-extension.ts` green on the release build
- [ ] Support email, GitHub issue templates and a privacy policy (no data collected by default)
- [ ] Rollback plan: keep the previous installer and a store version ready to re-publish
