# Problem discovery

## The problem
People who record interviews, meetings or lectures need accurate, timed, speaker-labelled text. Cloud tools such as TurboScribe, Otter and Rev solve accuracy and price. They do not solve **where the audio goes**:

- **Research ethics (IRB) and data-protection rules (GDPR, HIPAA, client NDAs)** often forbid uploading identifiable recordings to a third-party processor without a data-processing agreement. Many individual users can't get one signed.
- **Journalists** protecting sources, and **lawyers or HR** handling grievances and depositions, carry the same risk.
- **Subscription fatigue:** $10–30 a month for something a gaming-class GPU can do offline.
- **Connectivity:** field researchers and travellers have slow or no upload bandwidth for multi-gigabyte video.

## Evidence so far (observed, not yet validated with interviews)
- TurboScribe's own FAQ spends a whole answer on security ("encrypted, only you can access", a separate Security FAQ). Privacy is clearly a buying objection they have to handle.
- The local Whisper app category exists and sells: MacWhisper (one-time license), VoiceInk, Buzz. These are mostly **macOS**. Windows options are developer tools or plain wrappers without speaker labels or editors.

## Problem statement
> "I have recordings I'm not allowed to upload. I need a transcript with speakers and timestamps that I can edit and export to Word or subtitles, today, on my own Windows PC, without a subscription."

## Open questions → feed [02-validation/customer-interviews](../../02-validation/customer-interviews/)
- How often is "can't upload" a hard rule rather than a preference?
- Do target users actually have NVIDIA GPUs? CPU speed with `small` is about 0.3–0.5× real time, which is usable for short files only.
