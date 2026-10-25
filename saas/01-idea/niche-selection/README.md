# Niche selection

**Status: Done.** Part of [01 · Idea](../README.md) in the [Murmur SaaS plan](../../README.md).

## Candidates scored (1–5)
| Niche | Pain (privacy) | Willingness to pay | Reachability | Fit with Murmur today | Total |
|---|---|---|---|---|---|
| **Qualitative researchers / PhD students** | 5 (ethics rules) | 3 (grant or department budget) | 5 (subreddits, methods lists, university IT) | 5 (interviews, 2–4 speakers, DOCX export) | **18** |
| Journalists / documentary makers | 5 | 3 | 3 | 4 (subtitles, video) | 15 |
| Legal / HR / compliance teams | 5 | 5 | 2 (slow sales) | 3 (needs audit trail, team accounts) | 15 |
| Podcasters / YouTubers | 1 | 2 | 5 | 3 | 11 |
| Therapists / clinicians | 5 | 4 | 2 | 2 (needs HIPAA posture, summaries) | 13 |

## Choice
**Beachhead: qualitative researchers on Windows.** Their pain is strongest and most explicit, their communities are easy to reach, and they need exactly what the MVP does: an interview transcript with speakers, timestamps, edits and a Word export.

**Second ring:** journalists (add subtitle styling and an SRT burn-in helper), then legal/HR teams (add a team server, audit log and SSO; see [16-scaling](../../16-scaling/)).

## Persona: "Priya, PhD candidate"
- 30 semi-structured interviews of 45–90 minutes each, 2 speakers, English plus some Hindi.
- Ethics approval says "no third-party cloud processing". She has a gaming laptop with an RTX 3060.
- She currently transcribes by hand (about 6 h per interview hour) or pays a human service, which her ethics office has to approve.
- Success for her: about 30 h of audio done in a weekend, exported to DOCX for NVivo or ATLAS.ti.
