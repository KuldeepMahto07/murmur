# Opportunity mapping

## Value proposition
**"Private transcription that never leaves your PC."** Accuracy on par with the cloud tools (same Whisper family), speakers, editing, Word and subtitle export, for a one-time price.

## Opportunity map (impact × effort)
| Opportunity | Impact | Effort | Call |
|---|---|---|---|
| Windows desktop installer (no Python or Node setup) | High | Medium | **Do first.** Today's setup is a developer setup and blocks every non-technical buyer |
| One-click pyannote setup (guided HF token) | High | Low | Do. Speaker quality is a selling point |
| NVivo / ATLAS.ti friendly export (DOCX with speaker styles, timestamps) | High for the researcher niche | Low | Do |
| Local AI summaries / Q&A (small local LLM, e.g. via Ollama) | Medium-high | Medium | Next. Competitors are adding "AI chat" |
| Watch folder / batch queue | Medium | Low | Next |
| Team server (one GPU box for a department, browser clients) | High revenue | High | Later. Reuses today's web architecture |
| Hosted cloud tier | Low (contradicts the positioning) | High | Avoid for now |

## Business model hypothesis (to test in 02)
- **Free:** Swift and Steady modes, files up to 30 min, all exports.
- **Pro license, about $49 one-time (with 1 year of updates):** Precise mode, unlimited length, batch, pyannote setup wizard, summaries.
- **Team server, about $499 a year per server:** multiple users, shared library, roles, audit log.
