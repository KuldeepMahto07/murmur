# Expansion strategy

| Order | Expansion | Why / prerequisite |
|---|---|---|
| 1 | **Team server** (Docker image for one GPU box, multi-user) | Highest revenue per customer; needs [05/authentication](../../05-development/authentication/) |
| 2 | **macOS build** (Apple Silicon, faster-whisper CPU or whisper.cpp Metal) | About half of researchers use Macs, but this competes directly with MacWhisper, so the differentiator has to be speakers + team |
| 3 | **UI localisation** (Spanish, German, French, Portuguese, Hindi) | Transcription is already about 99 languages; the UI is English-only |
| 4 | **New verticals:** legal (deposition formatting), medical (on-device scribing, which needs a compliance review), education (lecture captions) | Each needs vocabulary packs + export templates |
| 5 | **Linux build** | Lab servers; easy given the Python backend |
