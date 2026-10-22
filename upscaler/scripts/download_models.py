"""Fetch every model weight Clarion uses into upscaler/models/."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.models_registry import WEIGHTS, ensure, sha256  # noqa: E402

for key, w in WEIGHTS.items():
    p = ensure(key)
    print(f"{key:12} {p.stat().st_size/1e6:7.1f} MB  {w.license:13} {sha256(p)[:16]}  {p.name}")
