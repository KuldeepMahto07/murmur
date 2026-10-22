"""Offline transcript translation with Argos Translate (language packs download on first use)."""
import copy
import logging
import threading

log = logging.getLogger("murmur.translate")
_lock = threading.Lock()
_index_loaded = False


def _ensure_index():
    global _index_loaded
    import argostranslate.package as pkg
    if not _index_loaded:
        pkg.update_package_index()
        _index_loaded = True
    return pkg


def target_languages() -> list[dict]:
    """Languages reachable from English (Argos pivots through English)."""
    try:
        pkg = _ensure_index()
        codes = {p.to_code: p.to_name for p in pkg.get_available_packages() if p.from_code == "en"}
    except Exception as e:
        log.warning("Argos index unavailable: %s", e)
        return []
    codes["en"] = "English"
    return [{"code": c, "name": n} for c, n in sorted(codes.items(), key=lambda kv: kv[1])]


def _install(src: str, dst: str):
    import argostranslate.translate as tr
    pkg = _ensure_index()
    installed = {(p.from_code, p.to_code) for p in pkg.get_installed_packages()}
    wanted = [(src, dst)] if src == "en" or dst == "en" else [(src, "en"), ("en", dst)]
    available = {(p.from_code, p.to_code): p for p in pkg.get_available_packages()}
    for pair in wanted:
        if pair in installed:
            continue
        if pair not in available:
            raise ValueError(f"No offline translation model for {pair[0]} → {pair[1]}")
        log.info("Downloading Argos model %s→%s", *pair)
        pkg.install_from_path(available[pair].download())
    return tr


def translate_transcript(transcript: dict, target: str, progress=None) -> dict:
    src = (transcript.get("language") or "en").split("-")[0]
    if src == target:
        return copy.deepcopy(transcript)
    with _lock:
        tr = _install(src, target)
        out = copy.deepcopy(transcript)
        segs = out["segments"]
        for i, seg in enumerate(segs):
            seg["text"] = tr.translate(seg["text"], src, target)
            seg["words"] = []  # word timings don't survive translation
            if progress:
                progress(i + 1, len(segs))
    out["language"] = target
    out["translated_from"] = src
    return out
