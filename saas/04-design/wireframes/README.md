# Wireframes

**Status: Done (recorded after build).** Part of [04 · Design](../README.md) in the [Murmur SaaS plan](../../README.md).

**Built:** no separate wireframes. The layouts were designed directly in code. These ASCII wireframes record the three shipped screens so changes can be discussed:

```
UPLOAD (#/)                         LIBRARY (#/library)                  TRANSCRIPT (#/t/<id>)
┌ Murmur      [New] [Library] ┐    ┌ Library  [filter]  [+ New] ┐       ┌ ← Library   Title (editable)        ┐
│  Headline + lede            │    │ [bulk bar: fmt ▼ ZIP Delete]│       │ ┌player┐   │ Speaker 1             │
│ ┌ Files | Link ───────────┐ │    │ ☐ name  status  len  lang  │       │ │speed │   │ 0:00 passage …        │
│ │  drop zone / url input  │ │    │ ☐ name  ▓▓▓░ 45%           │       │ ├tools─┤   │ 0:04 passage …        │
│ │ language ▼              │ │    │ ☐ name  Failed  retry      │       │ │search│   │ Speaker 2             │
│ │ [Swift][Steady][Precise]│ │    └────────────────────────────┘       │ │☑ts ☑follow ☐edit     │ 0:08 …  │
│ │ ☐ speakers  (count ▼)   │ │                                         │ │[Download][Speakers][Translate]       │
│ │ ☐ to English ☐ clean up │ │                                         │ │panel (export/speakers/translate)     │
│ │ [ Transcribe ]          │ │                                         │ └──────┘   │                       │
│ └─────────────────────────┘ │                                         └─────────────────────────────────────┘
│ 4 feature tiles             │
└─────────────────────────────┘
```

**Missing:** wireframes for the planned screens: onboarding / first-run model download, the settings page (HF token, device, storage path), and the license or upgrade screen.
