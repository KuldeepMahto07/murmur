# DevOps

**Built:** `start.bat` (build the UI if missing, run uvicorn). `requirements.txt` with torch pins. `.env.example`. `.gitignore` excludes the venv, `data/`, `node_modules`, `dist`, `.env`.

**Missing:**
- **Reproducible environment:** a lockfile (`uv pip compile` → `requirements.lock`) so torch, pyannote and speechbrain can't drift again (it happened once: torch got silently upgraded to a CPU build).
- **Packaging:** Windows installer pipeline (see [03-planning/tech-stack](../../03-planning/tech-stack/)) and a Docker image (`nvidia/cuda` base) for the team server.
- **Release process:** semantic version tags, changelog, GitHub Releases with installer artifacts.
