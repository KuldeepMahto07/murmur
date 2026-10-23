# DevOps

**Status: Not started.** Part of [06 · Infrastructure](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Release process to set up
1. **Versioning:** semver in one place, with `manifest.json` and the app version kept in step by a script.
2. **Build:** desktop package (see [development-plan](../../03-planning/development-plan/README.md)) and the extension zip (`extension/` with no test files).
3. **Code signing:**
   - Windows app: a cloud signing service such as Azure Artifact Signing, or an OV/EV certificate. Without signing, SmartScreen warns every new user.
   - Extension: the stores sign it.
4. **Publish:** GitHub Release → winget manifest PR (`microsoft/winget-pkgs`) → Chrome and Edge store uploads.
5. **Changelog:** generated from commit messages for each release.
