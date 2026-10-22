"""End-to-end check against a running Murmur server: upload -> transcribe -> diarize -> every export."""
import argparse
import sys
import time
from pathlib import Path

import requests

ap = argparse.ArgumentParser()
ap.add_argument("file", nargs="?", default=str(Path(__file__).parents[1] / "samples" / "two-voices.wav"))
ap.add_argument("--base", default="http://127.0.0.1:8000")
ap.add_argument("--mode", default="steady")
ap.add_argument("--speakers", type=int, default=2)
ap.add_argument("--no-diarize", action="store_true")
a = ap.parse_args()

opts = {"language": "", "mode": a.mode, "diarize": str(not a.no_diarize).lower(),
        "num_speakers": a.speakers, "translate_to_english": "false", "clean_audio": "false"}
with open(a.file, "rb") as f:
    r = requests.post(f"{a.base}/api/jobs", files={"files": (Path(a.file).name, f)}, data=opts)
r.raise_for_status()
job = r.json()[0]
print("job", job["id"], "queued")

t0 = time.time()
while job["status"] not in ("done", "failed"):
    time.sleep(2)
    job = requests.get(f"{a.base}/api/jobs/{job['id']}").json()
    print(f"  {job['status']:8} {job['stage']:22} {job['progress']*100:5.1f}%")
print(f"finished in {time.time()-t0:.1f}s: {job['status']} {job.get('error') or ''}")
if job["status"] != "done":
    sys.exit(1)

t = requests.get(f"{a.base}/api/jobs/{job['id']}/transcript").json()
print("language:", t["language"], "| segments:", len(t["segments"]), "| diarization:", job["diarization_method"])
for s in t["segments"]:
    print(f"  [{s['start']:6.2f}-{s['end']:6.2f}] {s['speaker'] or '-':11} {s['text']}")

ok = True
for fmt in ["txt", "srt", "vtt", "csv", "json", "docx", "pdf"]:
    r = requests.get(f"{a.base}/api/jobs/{job['id']}/export", params={"format": fmt})
    good = r.status_code == 200 and len(r.content) > 50
    magic = {"docx": b"PK", "pdf": b"%PDF"}.get(fmt)
    if magic:
        good = good and r.content.startswith(magic)
    ok &= good
    print(f"export {fmt:5} {r.status_code} {len(r.content):7} bytes {'OK' if good else 'FAIL'}")
    out = Path(__file__).parents[1] / "samples" / "out"
    out.mkdir(exist_ok=True)
    (out / f"{job['id']}.{fmt}").write_bytes(r.content)

r = requests.post(f"{a.base}/api/export/bulk", json={"ids": [job["id"]], "format": "srt"})
print("bulk zip", r.status_code, len(r.content), "bytes")
ok &= r.status_code == 200 and r.content.startswith(b"PK")
print("ALL OK" if ok else "SOME CHECKS FAILED")
sys.exit(0 if ok else 1)
