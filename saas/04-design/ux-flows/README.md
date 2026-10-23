# UX flows

**Built:**
1. **Transcribe:** Upload → pick options → Transcribe → library with live progress (polls every 1.5 s) → click "Ready" → transcript.
2. **Fix and export:** Transcript → rename speakers → edit text (saves on blur) / reassign a turn's speaker → Download → pick format + timestamps/speakers.
3. **Translate:** Transcript → Translate → pick language (first use downloads about 100 MB model) → language tab appears → download translated file.
4. **Bulk:** Library → select → format → ZIP, or Delete (with confirm).
5. **Demo:** no server → banner → sample transcript (read-only).

**Missing or friction:**
- First run: nothing explains the one-time model downloads (base about 150 MB, small about 500 MB, turbo about 1.6 GB). The job just sits on "Loading speech model". Add a download progress stage.
- No "undo" for text edits, and no edit history.
- Translation is a blocking request with only a spinner. Make it a job with progress.
- No notification when a long job finishes (browser notification or tray toast).
