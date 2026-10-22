import { useEffect, useMemo, useRef, useState } from "react";
import { api, clock, Config, Job, Segment, speakerColor, speakerName, Transcript } from "./api";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|wmv|m4v|3gp|mts|ts|vob)$/i;
const FORMAT_LABELS: Record<string, string> = {
  txt: "Plain text", docx: "Word document", pdf: "PDF", srt: "SubRip subtitles", vtt: "WebVTT subtitles",
  csv: "Spreadsheet (CSV)", json: "JSON with word timings",
};

function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>;
}

export default function TranscriptPage({ id, config }: { id: string; config: Config }) {
  const [job, setJob] = useState<Job | null>(null);
  const [lang, setLang] = useState<string>("");
  const [t, setT] = useState<Transcript | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(0);
  const [showTimes, setShowTimes] = useState(true);
  const [editing, setEditing] = useState(false);
  const [q, setQ] = useState("");
  const [panel, setPanel] = useState<"" | "export" | "speakers" | "translate">("");
  const media = useRef<HTMLMediaElement | null>(null);
  const activeRef = useRef<HTMLDivElement | null>(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    api.job(id).then(setJob).catch((e) => setErr(e.message));
  }, [id]);
  useEffect(() => {
    setT(null);
    api.transcript(id, lang || undefined).then(setT).catch((e) => setErr(e.message));
  }, [id, lang]);

  const active = useMemo(() => {
    if (!t) return -1;
    let idx = -1;
    for (const s of t.segments) {
      if (s.start <= now + 0.05) idx = s.id;
      else break;
    }
    return idx;
  }, [t, now]);

  useEffect(() => {
    if (follow && !editing && activeRef.current && !media.current?.paused)
      activeRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [active]);

  const speakers = useMemo(
    () => [...new Set((t?.segments || []).map((s) => s.speaker).filter(Boolean) as string[])].sort(),
    [t]
  );
  const matches = q ? (t?.segments || []).filter((s) => s.text.toLowerCase().includes(q.toLowerCase())).length : 0;

  const seek = (s: Segment) => {
    if (!media.current) return;
    media.current.currentTime = s.start;
    media.current.play();
  };

  const saveText = async (s: Segment, text: string) => {
    if (text.trim() === s.text) return;
    try {
      setT(await api.editSegments(id, [{ id: s.id, text }]));
    } catch (e: any) {
      setErr(e.message);
    }
  };

  // The dropdown sits on a turn's heading, so reassign every passage in that turn.
  const setSegSpeaker = async (s: Segment, speaker: string) => {
    if (!t) return;
    const turn: Segment[] = [];
    for (const seg of t.segments.slice(t.segments.findIndex((x) => x.id === s.id))) {
      if (seg.speaker !== s.speaker) break;
      turn.push(seg);
    }
    setT(await api.editSegments(id, turn.map((seg) => ({ id: seg.id, speaker }))));
  };

  if (err && !t) return <div className="banner error">{err}</div>;
  if (!job || !t) return <div className="loading">Loading transcript…</div>;
  const isVideo = VIDEO_EXT.test(job.media_file || "");
  const words = t.segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);

  return (
    <div className="transcript-page">
      <div className="t-head">
        <a href="#/library" className="back">← Library</a>
        <input
          className="title-edit"
          defaultValue={job.title}
          onBlur={(e) => e.target.value !== job.title && api.patch(id, { title: e.target.value }).then(setJob)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <div className="meta muted">
          {clock(job.duration)} · {words.toLocaleString()} words · {config.languages.find((l) => l.code === t.language)?.name || t.language}
          {job.diarization_method && ` · speakers by ${job.diarization_method}`}
        </div>
      </div>

      <div className="t-layout">
        <aside className="t-side">
          <div className={`player card ${isVideo ? "video" : ""}`}>
            {job.has_media &&
              (isVideo ? (
                <video ref={(el) => (media.current = el)} src={`/api/jobs/${id}/media`} controls onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
              ) : (
                <audio ref={(el) => (media.current = el)} src={`/api/jobs/${id}/media`} controls onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />
              ))}
            <div className="speed">
              {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button key={r} onClick={() => media.current && (media.current.playbackRate = r)}>{r}×</button>
              ))}
            </div>
          </div>

          <div className="toolbox card">
            <input className="text" placeholder="Search transcript" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <small className="muted">{matches} matching passage{matches === 1 ? "" : "s"}</small>}
            <label className="check"><input type="checkbox" checked={showTimes} onChange={(e) => setShowTimes(e.target.checked)} /> Show timestamps</label>
            <label className="check"><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> Follow playback</label>
            <label className="check"><input type="checkbox" checked={editing} disabled={!!lang} onChange={(e) => setEditing(e.target.checked)} /> Edit text</label>
            <div className="btnrow">
              <button className="primary" onClick={() => setPanel(panel === "export" ? "" : "export")}>Download</button>
              {speakers.length > 0 && <button onClick={() => setPanel(panel === "speakers" ? "" : "speakers")}>Speakers</button>}
              <button onClick={() => setPanel(panel === "translate" ? "" : "translate")}>Translate</button>
            </div>
            {(job.translations.length > 0 || lang) && (
              <div className="langtabs">
                <button className={!lang ? "on" : ""} onClick={() => setLang("")}>Original</button>
                {job.translations.map((l) => (
                  <button key={l} className={lang === l ? "on" : ""} onClick={() => setLang(l)}>{l}</button>
                ))}
              </div>
            )}
          </div>

          {panel === "export" && <ExportPanel id={id} lang={lang} formats={config.export_formats} hasSpeakers={speakers.length > 0} />}
          {panel === "speakers" && <SpeakerPanel job={job} speakers={speakers} onSave={setJob} />}
          {panel === "translate" && (
            <TranslatePanel id={id} source={t.language} onDone={(code) => api.job(id).then((j) => { setJob(j); setLang(code); setPanel(""); })} />
          )}
        </aside>

        <article className={`t-body card ${editing ? "editing" : ""}`}>
          {lang && <div className="banner info">Viewing translation ({lang}). Edits apply to the original transcript.</div>}
          {t.segments.map((s, i) => {
            const prev = t.segments[i - 1];
            const newSpeaker = s.speaker && (!prev || prev.speaker !== s.speaker);
            const hit = q && s.text.toLowerCase().includes(q.toLowerCase());
            if (q && !hit) return null;
            return (
              <div key={s.id} ref={s.id === active ? activeRef : undefined} className={`seg ${s.id === active ? "active" : ""} ${newSpeaker ? "turn" : ""}`}>
                {(newSpeaker || (q && s.speaker)) && (
                  <div className="who" style={{ color: speakerColor(s.speaker) }}>
                    <span className="dot" style={{ background: speakerColor(s.speaker) }} />
                    {speakerName(s.speaker, job.speakers)}
                    {editing && !lang && (
                      <select value={s.speaker || ""} onChange={(e) => setSegSpeaker(s, e.target.value)}>
                        {speakers.map((sp) => (
                          <option key={sp} value={sp}>{speakerName(sp, job.speakers)}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
                <div className="line">
                  {showTimes && (
                    <button className="ts" onClick={() => seek(s)} title="Play from here">{clock(s.start)}</button>
                  )}
                  {editing && !lang ? (
                    <p
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) => saveText(s, e.currentTarget.innerText)}
                      className={s.edited ? "edited" : ""}
                    >
                      {s.text}
                    </p>
                  ) : (
                    <p onClick={() => seek(s)}><Highlight text={s.text} q={q} /></p>
                  )}
                </div>
              </div>
            );
          })}
          {t.segments.length === 0 && <p className="muted">No speech was found in this file.</p>}
        </article>
      </div>
    </div>
  );
}

function ExportPanel({ id, lang, formats, hasSpeakers }: { id: string; lang: string; formats: string[]; hasSpeakers: boolean }) {
  const [ts, setTs] = useState(true);
  const [sp, setSp] = useState(true);
  return (
    <div className="card panel">
      <h4>Download</h4>
      <label className="check"><input type="checkbox" checked={ts} onChange={(e) => setTs(e.target.checked)} /> Include timestamps</label>
      {hasSpeakers && <label className="check"><input type="checkbox" checked={sp} onChange={(e) => setSp(e.target.checked)} /> Include speaker names</label>}
      <div className="formats">
        {formats.map((f) => (
          <a key={f} className="fmt" href={api.exportUrl(id, f, ts, sp, lang || undefined)} download>
            <b>{f.toUpperCase()}</b>
            <small>{FORMAT_LABELS[f]}</small>
          </a>
        ))}
      </div>
    </div>
  );
}

function SpeakerPanel({ job, speakers, onSave }: { job: Job; speakers: string[]; onSave: (j: Job) => void }) {
  const [names, setNames] = useState<Record<string, string>>(job.speakers);
  return (
    <div className="card panel">
      <h4>Speaker names</h4>
      {speakers.map((s) => (
        <label key={s} className="field inline">
          <span className="dot" style={{ background: speakerColor(s) }} />
          <input className="text" placeholder={speakerName(s, {})} value={names[s] || ""} onChange={(e) => setNames({ ...names, [s]: e.target.value })} />
        </label>
      ))}
      <button className="primary" onClick={() => api.patch(job.id, { speakers: names }).then(onSave)}>Save names</button>
    </div>
  );
}

function TranslatePanel({ id, source, onDone }: { id: string; source: string; onDone: (code: string) => void }) {
  const [langs, setLangs] = useState<{ code: string; name: string }[] | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.translationLanguages().then(setLangs).catch((e) => setErr(e.message));
  }, []);
  return (
    <div className="card panel">
      <h4>Translate</h4>
      <p className="muted small">Runs offline with Argos Translate. The first use of a language pair downloads a ~100 MB model.</p>
      {langs === null && !err && <p className="muted">Loading languages…</p>}
      {langs && langs.length === 0 && <p className="muted">No translation models reachable (offline?).</p>}
      {langs && langs.length > 0 && (
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Choose a language…</option>
          {langs.filter((l) => l.code !== source).map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
      )}
      {err && <div className="banner error">{err}</div>}
      <button
        className="primary"
        disabled={!target || busy}
        onClick={async () => {
          setBusy(true);
          setErr("");
          try {
            await api.translate(id, target);
            onDone(target);
          } catch (e: any) {
            setErr(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Translating…" : "Translate"}
      </button>
    </div>
  );
}
