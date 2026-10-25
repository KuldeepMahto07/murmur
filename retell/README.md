# Retell

Give Retell a viral clip (file or link) and it makes a narrated commentary video in the "things you missed" style. It freezes on key moments, zooms in, draws circles, arrows and spotlights, voices the narration with word-highlight captions, and adds sound effects.

- `saas/`: business lifecycle docs (16 stages); the Mirror Thinks / MoneyPrinterTurbo comparison is in `saas/01-idea/`
- `engine/`: the pipeline (`plan.py` Claude beat plan, `voice.py` TTS, `sfx.py` sound effects, `draw.py` effects and captions, `render.py` timeline and mix)

## Setup (Windows)
Needs Python 3.12, ffmpeg on PATH, and `ANTHROPIC_API_KEY` set. yt-dlp is only needed for links.
```bash
python -m venv .venv
```
```bash
.venv/Scripts/pip install -r requirements.txt
```

## Use
One step, from clip to video:
```bash
.venv/Scripts/python retell.py make "C:/clips/dog.mp4" --context "Dog waits at the door every day for its owner"
```
Or check the plan before rendering:
```bash
.venv/Scripts/python retell.py plan "https://www.youtube.com/shorts/..."
```
This writes `work/<name>/plan.json` and `work/<name>/sheet.jpg`. The sheet shows every beat with its circle or arrow drawn on it. Edit `plan.json` (wording, times, `x`/`y` positions, `zoom`, `sfx`), then:
```bash
.venv/Scripts/python retell.py sheet <name>
```
```bash
.venv/Scripts/python retell.py render <name> --music bed.mp3
```
The result is `work/<name>/output.mp4`.

No API key? Run `retell.py prep <clip>` to get timestamped frame grids (`work/<name>/grid_*.jpg`). Write `plan.json` yourself, or ask Claude Code to write it from the grids, then run `sheet` and `render`. `scripts/test_plan.json` is a complete example.

### plan.json beats
| field | values |
|---|---|
| `t` | second in the source clip |
| `mode` | `freeze`: pause on that frame while talking. `over`: talk while the clip plays, original audio ducked |
| `narration` | the spoken line |
| `effect.type` | `none`, `circle`, `arrow`, `spotlight`; `x`/`y` are 0–1 positions in the frame, `r` is the radius; `label` is an optional tag |
| `zoom` | 1.0–2.5, zooms toward the effect |
| `sfx` | `none`, `pop`, `whoosh`, `ding`, `riser`, `boom`, `scratch`, `click` |

Voices: `--voice en-US-GuyNeural` (list them with `.venv/Scripts/edge-tts --list-voices`). The default voice is `en-US-AndrewMultilingualNeural`. Sound effects are synthesised; to use real ones, put files with the same names in `sfx/`.

## Using other people's clips
Commentary is only defensible, and only monetisable on YouTube, when the narration adds something the viewer would not get from the clip alone. Credit the original creator. Don't use clips whose owner has asked for them not to be reused.
