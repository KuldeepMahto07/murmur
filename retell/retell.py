"""Retell: turn a viral clip into a narrated commentary video.

  python retell.py make <file-or-url> [--context "..."]   plan + sheet + render in one go
  python retell.py plan <file-or-url> [--context "..."]   write work/<name>/plan.json and sheet.jpg
  python retell.py prep <file-or-url>                      only fetch + timestamped frame grids (to write plan.json by hand / in Claude Code)
  python retell.py sheet <work-dir>                        redraw sheet.jpg after editing plan.json
  python retell.py render <work-dir>                       render work/<name>/output.mp4 from plan.json
"""
from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

from engine import plan as planmod
from engine.media import fetch, probe, sample_frames
from engine.render import contact_sheet, render
from engine.voice import DEFAULT_VOICE

ROOT = Path(__file__).resolve().parent
WORK = ROOT / "work"


def work_dir_for(source: str) -> Path:
    if source.startswith(("http://", "https://")):
        name = "url-" + hashlib.sha1(source.encode()).hexdigest()[:8]
    else:
        name = re.sub(r"[^\w-]+", "-", Path(source).stem).strip("-")[:40] or "clip"
    return WORK / name


def resolve_work(arg: str) -> Path:
    p = Path(arg)
    if p.is_dir():
        return p
    if (WORK / arg).is_dir():
        return WORK / arg
    sys.exit(f"No work folder {arg!r}. Run `plan` first.")


def cmd_plan(args) -> Path:
    work = work_dir_for(args.source)
    src = fetch(args.source, work)
    info = probe(src)
    print(f"[retell] {src.name}: {info.duration:.1f}s {info.width}x{info.height} @ {info.fps:.0f}fps")
    print(f"[retell] asking {planmod.MODEL} for a beat plan...")
    plan = planmod.write_plan(info, work, args.context or "")
    print(f"[retell] {len(plan.beats)} beats - \"{plan.title}\"")
    for b in plan.beats:
        print(f"   {b.t:6.1f}s {b.mode:6} {b.effect.type:9} {b.sfx:7} {b.narration}")
    sheet = contact_sheet(plan, info, work)
    print(f"[retell] plan:  {work / 'plan.json'}\n[retell] sheet: {sheet}")
    return work


def cmd_prep(args) -> None:
    from PIL import Image, ImageDraw
    from engine.draw import font

    work = work_dir_for(args.source)
    src = fetch(args.source, work)
    info = probe(src)
    every = max(0.5, info.duration / 48)
    frames = [(t, f) for t, f in sample_frames(src, work / "frames", every, 480) if t <= info.duration]
    tw, th = Image.open(frames[0][1]).size
    cols, per = 4, 16
    for g in range(0, len(frames), per):
        batch = frames[g:g + per]
        sheet = Image.new("RGB", (cols * tw, ((len(batch) + cols - 1) // cols) * th), (0, 0, 0))
        for i, (t, f) in enumerate(batch):
            tile = Image.open(f).convert("RGB")
            d = ImageDraw.Draw(tile)
            d.rectangle((0, 0, 130, 30), fill=(0, 0, 0))
            d.text((6, 3), f"t={t:.2f}s", font=font(22), fill=(255, 255, 0))
            sheet.paste(tile, ((i % cols) * tw, (i // cols) * th))
        out = work / f"grid_{g // per + 1}.jpg"
        sheet.save(out, quality=85)
        print(out)
    print(f"[retell] {info.duration:.1f}s {info.width}x{info.height}, audio={'yes' if info.has_audio else 'no'}; "
          f"write {work / 'plan.json'} then run: retell.py sheet {work.name}")


def cmd_sheet(args) -> None:
    work = resolve_work(args.work)
    info = probe(next(work.glob("source.*")))
    print(contact_sheet(planmod.load(work / "plan.json"), info, work))


def cmd_render(args, work: Path | None = None) -> None:
    work = work or resolve_work(args.work)
    info = probe(next(work.glob("source.*")))
    plan = planmod.load(work / "plan.json")
    music = Path(args.music) if args.music else None
    out = render(plan, info, work, voice=args.voice, music=music)
    print(f"[retell] done: {out}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    def render_opts(p):
        p.add_argument("--voice", default=DEFAULT_VOICE, help="Edge TTS voice (edge-tts --list-voices)")
        p.add_argument("--music", help="Optional background music file, looped and ducked")

    p = sub.add_parser("plan"); p.add_argument("source"); p.add_argument("--context")
    p = sub.add_parser("prep"); p.add_argument("source")
    p = sub.add_parser("sheet"); p.add_argument("work")
    p = sub.add_parser("render"); p.add_argument("work"); render_opts(p)
    p = sub.add_parser("make"); p.add_argument("source"); p.add_argument("--context"); render_opts(p)
    args = ap.parse_args()

    if args.cmd == "plan":
        cmd_plan(args)
    elif args.cmd == "prep":
        cmd_prep(args)
    elif args.cmd == "sheet":
        cmd_sheet(args)
    elif args.cmd == "render":
        cmd_render(args)
    else:
        cmd_render(args, cmd_plan(args))


if __name__ == "__main__":
    main()
