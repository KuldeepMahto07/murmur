# UX flows

**Built flows**
1. **Drop → auto-run:** drop files, each is queued with the current settings, and the viewer selects the new job.
2. **Preview → approve → full:** tick "Preview only the first N s", compare, then click **Render full video** (re-runs the same source with `preview: false`).
3. **Re-run with new settings:** any finished job can be reprocessed without re-uploading (`POST /api/jobs/{id}/rerun`).
4. **Compare:** image wipe with Fit/100%/200% zoom; video wipe or side-by-side with synced playback.

**Gaps found with a real user**
- Asked for "16K 60 fps". The UI caps at 4K but never explains why. Add an inline hint: "4K is the most phones and social apps display."
- A long render (56 min) has no notification and no per-job ETA in the queue list, only in the viewer.
- No "open output folder" or "save next to the original" option; downloads go through the browser.
