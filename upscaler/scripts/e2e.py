"""End-to-end check against a running Clarion server (default http://127.0.0.1:8001).

Upscales samples/portrait_small.png (4x, faces on) and samples/clip_small.mp4 (1080p preview + full 2x with 2x slow motion),
then verifies the outputs' dimensions, frame counts and audio with OpenCV / ffprobe.
"""
import json
import subprocess
import sys
import time
import urllib.request
import uuid
from pathlib import Path

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "samples" / "out"
OUT.mkdir(parents=True, exist_ok=True)


def post_file(path: Path, settings: dict) -> dict:
    b = uuid.uuid4().hex
    body = (
        f"--{b}\r\nContent-Disposition: form-data; name=\"settings\"\r\n\r\n{json.dumps(settings)}\r\n"
        f"--{b}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{path.name}\"\r\n"
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode() + path.read_bytes() + f"\r\n--{b}--\r\n".encode()
    req = urllib.request.Request(f"{BASE}/api/jobs", body, {"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(req))


def post_json(url: str, data: dict) -> dict:
    req = urllib.request.Request(BASE + url, json.dumps(data).encode(), {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req))


def wait(job: dict) -> dict:
    t0 = time.time()
    while True:
        j = json.load(urllib.request.urlopen(f"{BASE}/api/jobs/{job['id']}"))
        if j["status"] in ("done", "error", "cancelled"):
            print(f"  {j['status']} in {time.time() - t0:.1f}s: {j['message']}  result={j.get('result')}")
            if j["status"] != "done":
                raise SystemExit(f"FAILED: {j['name']}")
            return j
        time.sleep(1)


def fetch(j: dict, key: str, dest: Path) -> Path:
    urllib.request.urlretrieve(BASE + j["urls"][key], dest)
    return dest


def ffprobe(p: Path) -> dict:
    r = subprocess.run(["ffprobe", "-v", "error", "-count_frames", "-print_format", "json", "-show_streams", str(p)],
                       capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"]
    v = next(x for x in s if x["codec_type"] == "video")
    return {"w": v["width"], "h": v["height"], "codec": v["codec_name"], "pix": v.get("pix_fmt"),
            "frames": int(v.get("nb_read_frames", 0)), "fps": v["avg_frame_rate"],
            "audio": [x["codec_name"] for x in s if x["codec_type"] == "audio"]}


def main() -> None:
    import cv2

    ok = True
    img = ROOT / "samples" / "portrait_small.png"
    src = cv2.imread(str(img))
    print(f"IMAGE {img.name} {src.shape[1]}x{src.shape[0]} -> 4x, faces on")
    j = wait(post_file(img, {"preset": "balanced", "scale": 4, "faces": True, "denoise": 0.5}))
    out = cv2.imread(str(fetch(j, "output", OUT / "portrait_4x.png")))
    good = out.shape[1] == src.shape[1] * 4 and out.shape[0] == src.shape[0] * 4
    print(f"  output {out.shape[1]}x{out.shape[0]}  {'OK' if good else 'BAD SIZE'}")
    ok &= good
    # side-by-side proof image (bicubic vs Clarion)
    bic = cv2.resize(src, (out.shape[1], out.shape[0]), interpolation=cv2.INTER_CUBIC)
    cv2.imwrite(str(OUT / "portrait_compare.png"), cv2.hconcat([bic, out]))

    for preset in ("illustration", "restore", "lite"):
        j = wait(post_file(img, {"preset": preset, "scale": 2, "image_format": "jpg"}))
        o = cv2.imread(str(fetch(j, "output", OUT / f"portrait_{preset}.jpg")))
        good = o.shape[1] == src.shape[1] * 2
        print(f"  preset {preset}: {o.shape[1]}x{o.shape[0]} {'OK' if good else 'BAD'}")
        ok &= good

    vid = ROOT / "samples" / "clip_small.mp4"
    info = ffprobe(vid)
    print(f"VIDEO {vid.name} {info}")
    print("  preview: first 2 s -> 1080p H.264")
    p = wait(post_file(vid, {"preset": "balanced", "target": "1080p", "scale": None, "preview": True, "preview_seconds": 2}))
    pi = ffprobe(fetch(p, "output", OUT / "clip_preview_1080p.mp4"))
    print(f"  -> {pi}")
    ok &= pi["h"] == 1080 and pi["codec"] == "h264" and bool(pi["audio"])

    print("  full: rerun of the same source at 2x, 2x slow motion, H.265 10-bit")
    f = wait(post_json(f"/api/jobs/{p['id']}/rerun",
                       {"preset": "balanced", "scale": 2, "slowmo": 2, "codec": "h265", "faces": True}))
    fi = ffprobe(fetch(f, "output", OUT / "clip_full_2x_slowmo.mp4"))
    print(f"  -> {fi}")
    exp = info["frames"] * 2
    ok &= fi["w"] == info["w"] * 2 and fi["codec"] == "hevc" and abs(fi["frames"] - exp) <= 3
    fetch(f, "before", OUT / "clip_before_proxy.mp4")
    fetch(f, "after", OUT / "clip_after_proxy.mp4")

    print("  full: 4x, ProRes, 60 fps interpolation")
    g = wait(post_json(f"/api/jobs/{p['id']}/rerun", {"preset": "illustration", "scale": 4, "fps": 60, "codec": "prores"}))
    gi = ffprobe(fetch(g, "output", OUT / "clip_4x_60fps.mov"))
    print(f"  -> {gi}")
    ok &= gi["w"] == info["w"] * 4 and gi["codec"] == "prores" and gi["fps"].startswith("60")

    print("ALL OK" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
