# 01 Idea

## Problem discovery
Faceless "clip commentary" channels (Mirror Thinks and many copycats) retell viral clips: pause on a moment, circle or point at a detail, explain it in a voiceover, add sound effects and captions. Done by hand in Premiere/CapCut this takes about 30 minutes to several hours per short. The time goes into four jobs:
1. Watching the clip several times to find the moments worth pointing at.
2. Writing short, spoken narration for each moment.
3. Recording or generating the voice, then laying it on the timeline.
4. Freezing frames, keyframing zooms, drawing circles and arrows, and placing captions and sound effects.

Jobs 1–2 are judgment. Jobs 3–4 are mechanical, and they take most of the time.

## Market research (to do)
- Count channels in the niche and their upload frequency (YouTube search: "wholesome moments explained", "things you missed in this video").
- Read creator forums (r/NewTubers, r/PartneredYoutube) for complaints about editing time.

## Niche selection
Start with short clip commentary: a 5–60 s source clip becomes a 20–120 s narrated video. It's the same niche as Mirror Thinks, and the same pipeline serves "reaction" and "explained" Shorts.

## Competitor analysis
| Product | What it does | Gap for this niche |
|---|---|---|
| Mirror Thinks (channel, the reference) | Hand-made retellings; ~517k subscribers; says each video takes 3–5 hours | This is the output we automate, not a tool |
| MoneyPrinterTurbo (open source) | Topic → LLM script → stock footage → TTS → subtitles | Never looks at a specific clip. No freeze-frames, circles, arrows or timed reveals. Its stock-montage output risks YouTube's inauthentic-content policy |
| CapCut / Premiere | Manual editing; CapCut has auto captions and TTS | Everything clip-specific is still manual |
| Opus Clip / Vizard | Cut long videos into shorts | Don't add commentary |

## Opportunity mapping
A tool that *watches* the clip (vision model on sampled frames), writes the beat plan, and renders it gets a creator from clip to draft in a few minutes. The creator then spends their time on the judgment part: editing `plan.json`, re-recording lines in their own voice, picking the clip.

## Content rights (affects the product)
Commentary on someone else's clip is defensible only when the narration adds real observation (transformative use), and YouTube demonetises "reused content" with little added value. The prompt is written to force an observation on every beat. Users are responsible for the clips they use and for crediting the source; the README says so.
