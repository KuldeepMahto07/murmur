# UI design

**Built** (`frontend/src/styles.css`):
- Warm "paper" palette: ink `#1f1d2b`, paper `#f6f3ec`, coral accent `#e8603c`, teal `#2f8f83`.
- Serif display type (Iowan/Palatino) for headings and transcript text, system sans for controls.
- Waveform brand mark; speaker colours cycle through 8 hues.
- Responsive breakpoints at 900 px (transcript goes to one column) and 760 px (upload grid).
- Demo banner and read-only state for the Vercel build.

**Missing:**
- Dark mode.
- An accessibility audit: colour contrast of muted text (`#8a8696` on paper is likely below 4.5:1), focus rings on custom buttons, keyboard play/pause shortcut, ARIA labels on icon-like controls.
- Empty and error state illustrations.
- A proper logo and favicon set (the current favicon is an inline SVG dot).
