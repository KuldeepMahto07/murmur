# 03 Planning

**Status:** 🟡 In progress — development plan for the web UI still to write

## MVP scope (built)
A local CLI: `python retell.py make <clip-or-url>`
1. **Fetch.** Takes a local file, or a URL downloaded with yt-dlp.
2. **Plan.** Samples up to 60 frames. Claude (`claude-opus-5-5`, structured output) returns `plan.json`: title, and for each beat a time, `freeze`/`over` mode, narration, an effect (circle / arrow / spotlight + label), a zoom level and a sound effect.
3. **Sheet.** A contact sheet with every beat's effect drawn on its frame, so you can check positions before rendering.
4. **Render.** One forward pass over the source:
   - freezes with ease-in zoom and animated circles and arrows
   - narration from Edge TTS (free), with word-highlight captions
   - synthesised sound effects
   - original audio ducked under "over" beats
   - optional ducked music
   - H.264 MP4 at the source aspect ratio

## Feature prioritization (next)
1. Web UI: drop a clip, edit beats on a timeline, drag circles onto the frame, re-render.
2. Your own voice: record or upload each line, or use ElevenLabs/voice clone instead of Edge TTS.
3. Transcribe the clip's own speech (faster-whisper) so Claude knows what people say.
4. Vertical 9:16 output with a blurred-fill background for landscape clips.
5. Effect tracking: follow a moving subject during "over" beats.
6. A sound-effect pack (royalty-free files in `sfx/`) and music beds.

## Tech stack
Python 3.12, ffmpeg, Pillow and numpy for frames and audio, the `anthropic` SDK, `edge-tts`, `yt-dlp`.

## Product roadmap
MVP CLI (now) → local web UI → hosted SaaS (queue + GPU-less render workers; render cost is mostly CPU encode).
