# UX flows

**Status: Partial.** Part of [04 · Design](../README.md) in the [Fetchline SaaS plan](../../README.md).

## Flows that work today
1. **Add by URL:** paste anywhere or press N → dialog → Start now / Add to queue / Add paused.
2. **Video:** hover a video → Download → pick a quality → sent to Fetchline or AB DM. Encrypted or DRM content gets a clear explanation.
3. **Crash:** kill the app → restart → downloads resume on their own from the last checkpoint.
4. **Integrity:** paste an expected `sha256:` value → the download turns red on a mismatch.

## Gaps
- **No first-run guide.** It should cover how to install the extension and that the engine must be running. The tray app (`desktop/Fetchline.vbs`, with an optional Start with Windows) removes the need for `start.bat`. The "not running" message should point to it once there's an installer.
- **YouTube expectations.** The menu explains, but the store listing must say so up front.
