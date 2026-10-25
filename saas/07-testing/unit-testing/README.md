# Unit testing

**Status: Not started (plan written).** Part of [07 · Testing](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:** none as files. An ad-hoc smoke test of all exporters (fake transcript → 7 formats, DOCX/PDF magic bytes) was run during development but not saved.

**Write first (pytest, CPU only, no models needed):**
- `exports.py`: SRT/VTT timestamp formatting, cue splitting at `max_chars` / `max_seconds`, speaker prefixes, CSV BOM, DOCX/PDF magic bytes, non-Latin text in TXT.
- `pipeline.assign_speakers`: word→speaker by overlap, split at changes, one-word flicker folded back only when the speakers on both sides are the same (the bug fixed on 2026-10-22).
- `main.py` routes with a fake worker: create, list, patch speakers, edit segments, export 404/400 paths, bulk ZIP name de-duplication.
- Frontend: `clock()`, `speakerName()`, and the demo-mode fallbacks in `api.ts` (Vitest).
