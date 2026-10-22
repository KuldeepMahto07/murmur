"""Speaker diarization.

Uses pyannote/speaker-diarization-3.1 when HF_TOKEN is set (best quality). Otherwise falls back to
SpeechBrain ECAPA speaker embeddings over sliding windows plus agglomerative clustering, which needs
no token but is less accurate on overlapping speech.
"""
import logging
from pathlib import Path

import numpy as np

from .config import HF_TOKEN, MODELS_DIR
from .pipeline import load_wav as _load_wav

log = logging.getLogger("murmur.diarize")

Turn = tuple[float, float, str]
_pyannote = None
_ecapa = None


def available_method() -> str:
    return "pyannote" if HF_TOKEN else "ecapa"


def _torch_device():
    import torch
    return torch.device("cuda:0" if torch.cuda.is_available() else "cpu")




def diarize(wav: Path, num_speakers: int, speech_regions: list[tuple[float, float]]) -> tuple[list[Turn], str]:
    if HF_TOKEN:
        try:
            return _diarize_pyannote(wav, num_speakers), "pyannote"
        except Exception as e:
            log.warning("pyannote failed (%s); using ECAPA fallback", e)
    return _diarize_ecapa(wav, num_speakers, speech_regions), "ecapa"


def _diarize_pyannote(wav: Path, num_speakers: int) -> list[Turn]:
    global _pyannote
    import torch
    from pyannote.audio import Pipeline

    if _pyannote is None:
        _pyannote = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=HF_TOKEN)
        if _pyannote is None:
            raise RuntimeError("could not load pyannote pipeline (did you accept the model terms on Hugging Face?)")
        _pyannote.to(_torch_device())
    audio, sr = _load_wav(wav)
    kwargs = {"num_speakers": num_speakers} if num_speakers and num_speakers > 0 else {}
    result = _pyannote({"waveform": torch.from_numpy(audio)[None, :], "sample_rate": sr}, **kwargs)
    return [(t.start, t.end, spk) for t, _, spk in result.itertracks(yield_label=True)]


def _diarize_ecapa(wav: Path, num_speakers: int, speech_regions: list[tuple[float, float]]) -> list[Turn]:
    global _ecapa
    import torch
    from sklearn.cluster import AgglomerativeClustering
    from sklearn.metrics import silhouette_score
    from speechbrain.inference.speaker import EncoderClassifier

    if _ecapa is None:
        kwargs = {}
        try:
            from speechbrain.utils.fetching import LocalStrategy
            kwargs["local_strategy"] = LocalStrategy.COPY  # Windows has no symlinks without admin
        except ImportError:
            pass
        _ecapa = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            savedir=str(MODELS_DIR / "spkrec-ecapa-voxceleb"),
            run_opts={"device": str(_torch_device())},
            **kwargs,
        )

    audio, sr = _load_wav(wav)
    win, hop = 1.5, 0.75
    windows: list[tuple[float, float]] = []
    for rs, re_ in speech_regions:
        t = rs
        while True:
            end = min(t + win, re_)
            if end - t >= 0.5:
                windows.append((t, end))
            if end >= re_:
                break
            t += hop
    if not windows:
        return []

    embs = []
    batch = 32
    for i in range(0, len(windows), batch):
        chunk = windows[i:i + batch]
        n = int(win * sr)
        x = np.zeros((len(chunk), n), dtype=np.float32)
        lens = []
        for j, (s, e) in enumerate(chunk):
            a = audio[int(s * sr):int(e * sr)][:n]
            x[j, :len(a)] = a
            lens.append(len(a) / n)
        with torch.no_grad():
            e = _ecapa.encode_batch(torch.from_numpy(x), torch.tensor(lens))
        embs.append(e.squeeze(1).cpu().numpy())
    X = np.concatenate(embs)
    X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9

    if len(X) < 3:
        labels = np.zeros(len(X), dtype=int)
    elif num_speakers and num_speakers > 0:
        k = min(num_speakers, len(X))
        labels = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
    else:
        best_k, best_score, labels = 1, 0.12, np.zeros(len(X), dtype=int)  # below this, call it one speaker
        for k in range(2, min(8, len(X) - 1) + 1):
            lab = AgglomerativeClustering(n_clusters=k, metric="cosine", linkage="average").fit_predict(X)
            score = silhouette_score(X, lab, metric="cosine")
            if score > best_score:
                best_k, best_score, labels = k, score, lab
        log.info("ECAPA auto speaker count: %s (silhouette %.3f)", best_k, best_score)

    # Relabel in order of first appearance so the first voice is SPEAKER_00.
    order: dict = {}
    for lab in labels:
        order.setdefault(int(lab), len(order))
    turns: list[Turn] = []
    for (s, e), lab in zip(windows, labels):
        mid = (s + e) / 2
        ts, te = max(s, mid - hop / 2), min(e, mid + hop / 2)
        spk = f"SPEAKER_{order[int(lab)]:02d}"
        if turns and turns[-1][2] == spk and ts - turns[-1][1] < 0.3:
            turns[-1] = (turns[-1][0], te, spk)
        else:
            turns.append((ts, te, spk))
    return turns
