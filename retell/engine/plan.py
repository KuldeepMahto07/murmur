"""The beat plan: what to say, when to freeze, what to circle. Written by Claude from sampled frames."""
from __future__ import annotations

import base64
import json
import os
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .media import VideoInfo, sample_frames

MODEL = os.environ.get("RETELL_MODEL", "claude-opus-5-5")

SFX = Literal["none", "pop", "whoosh", "ding", "riser", "boom", "scratch", "click"]


class Effect(BaseModel):
    type: Literal["none", "circle", "arrow", "spotlight"] = "none"
    x: float = Field(0.5, description="Target centre, 0-1 across the frame width")
    y: float = Field(0.5, description="Target centre, 0-1 down the frame height")
    r: float = Field(0.08, description="Circle/spotlight radius as a fraction of frame width")
    from_x: Optional[float] = Field(None, description="Arrow tail x (0-1); defaults to an offset from the target")
    from_y: Optional[float] = Field(None, description="Arrow tail y (0-1)")
    label: str = Field("", description="Optional 1-4 word tag drawn next to the effect")
    color: Literal["yellow", "red", "white", "green"] = "yellow"


class Beat(BaseModel):
    t: float = Field(description="Second in the source clip this beat is anchored to")
    mode: Literal["freeze", "over"] = Field(
        description="freeze: pause the clip on this frame while narrating. over: narrate while the clip keeps playing (original audio ducked)")
    narration: str = Field(description="What the narrator says at this beat. Spoken, short sentences.")
    effect: Effect = Field(default_factory=Effect)
    zoom: float = Field(1.0, description="1.0 = no zoom, up to 2.5; zooms toward the effect target")
    sfx: SFX = "none"


class Plan(BaseModel):
    title: str = Field(description="A YouTube title for the finished video")
    beats: list[Beat]
    outro: str = Field("", description="Optional closing line said on the last frame")


SYSTEM = """You write and direct short commentary videos in the style of channels that retell viral clips: \
the narrator pauses the clip at the right moments, circles or points at a detail most viewers missed, and explains \
why it matters. The tone is warm, curious and a little playful, never mean. The value is in the observation: \
every beat must add something a viewer could not get by just watching the clip (a hidden detail, the reason \
behind a reaction, what happens next, a fact about the situation).

Rules:
- Start with a hook beat at or near t=0 (mode "over" or "freeze") that makes the viewer want to watch to the end, \
  without spoiling the payoff.
- Use "freeze" for reveals and details that need the viewer's eyes on one spot; use "over" for set-up and \
  connective narration while the action plays. Never freeze over the clip's own key spoken line or punchline; let it play.
- Each narration is 1-3 spoken sentences, about 6-35 words. Write it to be heard, not read: contractions, no emoji, \
  no stage directions, no hashtags, and write numbers as words when they are short.
- Effects: coordinates are fractions of the frame (x across, y down, 0-1) taken from the frame images you are shown \
  at that timestamp. Only circle or point at something you can actually see at that time. Prefer "circle" for \
  objects/faces, "arrow" for small or easy-to-miss things, "spotlight" to isolate one person in a busy scene. \
  Use "none" for beats that are just narration. In "over" beats only add an effect if the subject barely moves.
- zoom 1.3-2.0 on freezes where the detail is small; 1.0 otherwise.
- sfx: "scratch" or "pop" on a dramatic freeze, "whoosh" on a zoom, "ding" on a realisation, "riser" before a payoff, \
  "boom" for a big reveal, "click" for small points. Do not put a sound on every beat.
- Beats must be in time order, at least ~1 second apart, and inside the clip's duration.
- Aim for one beat every 3-8 seconds of clip; the finished video should run roughly 1.5-2.5x the clip length.
- An optional outro line can ask a question to the viewer. Do not ask for likes or subscriptions.
- If the frames are not enough to know what is going on, say only what you can see; never invent names or facts."""


def _img_block(path: Path) -> dict:
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.b64encode(path.read_bytes()).decode()},
    }


def write_plan(info: VideoInfo, work: Path, context: str = "", max_frames: int = 60) -> Plan:
    import anthropic

    every = max(0.5, info.duration / max_frames)
    frames = sample_frames(info.path, work / "frames", every)

    content: list[dict] = [{
        "type": "text",
        "text": (f"Clip: {info.duration:.1f} seconds, {info.width}x{info.height}, "
                 f"{'has' if info.has_audio else 'no'} audio track. "
                 f"Frames follow, one every {every:.2f}s, each preceded by its timestamp."
                 + (f"\n\nContext from the user (caption, source, what happens): {context}" if context else "")),
    }]
    for t, f in frames:
        if t > info.duration:
            break
        content.append({"type": "text", "text": f"t={t:.2f}s"})
        content.append(_img_block(f))
    content.append({"type": "text", "text": "Write the beat plan for this clip."})

    client = anthropic.Anthropic()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
        output_format=Plan,
        output_config={"effort": "high"},
        # Refusal fallbacks: on a policy decline the API re-runs the request on a fallback model.
        extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
        extra_body={"fallbacks": "default"},
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"Claude declined to write a plan: {response.stop_details}")
    plan: Plan = response.parsed_output
    plan.beats.sort(key=lambda b: b.t)
    save(plan, work / "plan.json")
    return plan


def save(plan: Plan, path: Path) -> None:
    path.write_text(json.dumps(plan.model_dump(), indent=2), encoding="utf-8")


def load(path: Path) -> Plan:
    return Plan.model_validate_json(path.read_text(encoding="utf-8"))
