# Funnel analysis

Funnel as defined in [11-conversion/sales-funnel](../../11-conversion/sales-funnel/):
`visit → download → first transcript → Pro gate → upgrade click → licence activated`

- **Website steps:** UTM-tagged links, plus the analytics "goal" on the download button.
- **App steps:** the opt-in events above. Activation means the first `transcript_completed` within 24 h of install.
- **Review weekly:** the biggest drop-off gets the next sprint's fix. The expected first culprit is install → first transcript, because of the model download wait and GPU setup.
