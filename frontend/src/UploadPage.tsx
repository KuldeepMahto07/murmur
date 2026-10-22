import { useRef, useState } from "react";
import { api, Config, Options } from "./api";
import { go } from "./App";

const ACCEPT = "audio/*,video/*,.mkv,.wma,.wmv,.flac,.aiff,.opus,.m4a,.3gp,.vob,.rmvb,.mts,.ts";

function fmtSize(b: number) {
  return b > 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : `${(b / (1 << 20)).toFixed(1)} MB`;
}

export default function UploadPage({ config }: { config: Config }) {
  const [tab, setTab] = useState<"file" | "link">("file");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [opt, setOpt] = useState<Options>({
    language: "",
    mode: config.default_mode,
    diarize: false,
    num_speakers: -1,
    translate_to_english: false,
    clean_audio: false,
  });
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpt((o) => ({ ...o, [k]: v }));

  const add = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => /^(audio|video)\//.test(f.type) || /\.\w+$/.test(f.name));
    setFiles((cur) => [...cur, ...incoming.filter((f) => !cur.some((c) => c.name === f.name && c.size === f.size))]);
  };

  const submit = async () => {
    setErr("");
    try {
      if (tab === "file") {
        if (!files.length) return setErr("Add at least one audio or video file.");
        setBusy(0);
        await api.upload(files, opt, setBusy);
      } else {
        if (!url.trim()) return setErr("Paste a link to a video or audio page.");
        setBusy(1);
        await api.fromUrl(url.trim(), opt);
      }
      go("#/library");
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="upload-page">
      <section className="hero">
        <h1>
          Turn recordings into <em>searchable text</em>.
        </h1>
        <p className="lede">
          Drop in interviews, lectures, meetings or podcasts. Murmur transcribes them on your own machine, labels who
          spoke, and hands you subtitles or documents — no account, no upload to anyone else.
        </p>
      </section>

      <section className="card composer">
        <div className="tabs">
          <button className={tab === "file" ? "on" : ""} onClick={() => setTab("file")}>Files</button>
          <button className={tab === "link" ? "on" : ""} onClick={() => setTab("link")}>Link</button>
        </div>

        {tab === "file" ? (
          <>
            <div
              className={`drop ${drag ? "drag" : ""}`}
              onClick={() => input.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                add(e.dataTransfer.files);
              }}
            >
              <div className="drop-wave" aria-hidden>
                {Array.from({ length: 24 }, (_, i) => (
                  <span key={i} style={{ animationDelay: `${(i % 8) * 0.12}s` }} />
                ))}
              </div>
              <strong>Drop audio or video here</strong>
              <span>or click to choose · MP3, WAV, M4A, FLAC, OGG, MP4, MOV, MKV, WEBM and more</span>
              <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => add(e.target.files)} />
            </div>
            {files.length > 0 && (
              <ul className="filelist">
                {files.map((f, i) => (
                  <li key={f.name + f.size}>
                    <span className="fname">{f.name}</span>
                    <span className="muted">{fmtSize(f.size)}</span>
                    <button className="link" onClick={() => setFiles(files.filter((_, j) => j !== i))}>remove</button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="linkbox">
            <input
              className="text"
              placeholder="https://www.youtube.com/watch?v=…  or any page with a video/podcast"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="muted small">Downloaded with yt-dlp. Only use links you have the right to transcribe.</p>
          </div>
        )}

        <div className="settings">
          <label className="field">
            <span>Spoken language</span>
            <select value={opt.language} onChange={(e) => set("language", e.target.value)}>
              <option value="">Detect automatically</option>
              {config.languages.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </select>
          </label>

          <div className="field">
            <span>Quality</span>
            <div className="modes">
              {config.modes.map((m) => (
                <button key={m.id} className={`mode ${opt.mode === m.id ? "on" : ""}`} onClick={() => set("mode", m.id)}>
                  <b>{m.label}</b>
                  <small>{m.hint}</small>
                  <code>{m.model}</code>
                </button>
              ))}
            </div>
          </div>

          <div className="toggles">
            <label className="toggle">
              <input type="checkbox" checked={opt.diarize} onChange={(e) => set("diarize", e.target.checked)} />
              <span>
                <b>Label speakers</b>
                <small>
                  Mark who is talking in each passage
                  {config.diarization_method === "ecapa" && " (basic mode — add an HF_TOKEN for pyannote)"}.
                </small>
              </span>
            </label>
            {opt.diarize && (
              <label className="field inline">
                <span>How many voices?</span>
                <select value={opt.num_speakers} onChange={(e) => set("num_speakers", Number(e.target.value))}>
                  <option value={-1}>Work it out</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="toggle">
              <input type="checkbox" checked={opt.translate_to_english} onChange={(e) => set("translate_to_english", e.target.checked)} />
              <span>
                <b>Output in English</b>
                <small>Translate speech from any language straight into English text.</small>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={opt.clean_audio} onChange={(e) => set("clean_audio", e.target.checked)} />
              <span>
                <b>Clean up noisy audio</b>
                <small>Filter hum and hiss before transcribing. Use only for rough recordings.</small>
              </span>
            </label>
          </div>
        </div>

        {err && <div className="banner error">{err}</div>}
        <button className="primary big" disabled={busy !== null} onClick={submit}>
          {busy === null
            ? `Transcribe${tab === "file" && files.length > 1 ? ` ${files.length} files` : ""}`
            : tab === "file"
            ? `Uploading… ${Math.round(busy * 100)}%`
            : "Queuing…"}
        </button>
      </section>

      <section className="features">
        <div><b>~99 languages</b><span>Whisper models, auto-detect or pick one.</span></div>
        <div><b>Who said what</b><span>Speaker labels you can rename.</span></div>
        <div><b>Every format</b><span>TXT, DOCX, PDF, SRT, VTT, CSV, JSON.</span></div>
        <div><b>Translate</b><span>Offline translation of finished transcripts.</span></div>
      </section>
    </div>
  );
}
