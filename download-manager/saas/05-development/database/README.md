# Database

**Status: Done (MVP).** Part of [05 · Development](../README.md) in the [Fetchline SaaS plan](../../README.md).

There is no database server. State is file-based, which suits a single-user desktop app:
- **`data/state.json`:** settings and the download list. It is written atomically (tmp file → fsync → rename) every second. It only records positions that have already been fsynced. Code: `Manager.save()` in [`engine/manager.ts`](../../../engine/manager.ts).
- **Partial files:** `.fetchline-<id>.part` is a sparse file written at absolute offsets in the destination folder, so finishing is just a rename.
- **HLS segments:** `.fetchline-<id>.hls/` holds one file per segment, each fsynced and renamed when complete.

**Later:** move to SQLite (`node:sqlite`) when history passes about 10k items or search is needed.
