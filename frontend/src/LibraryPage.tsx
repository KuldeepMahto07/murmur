import { useEffect, useState } from "react";
import { api, clock, Config, Job } from "./api";

const STATUS: Record<Job["status"], string> = { queued: "Queued", running: "Working", done: "Ready", failed: "Failed" };

export default function LibraryPage({ config }: { config: Config }) {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [fmt, setFmt] = useState("txt");
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");

  const load = () => api.jobs().then(setJobs).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);
  const active = jobs?.some((j) => j.status === "queued" || j.status === "running");
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [active]);

  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const shown = (jobs || []).filter((j) => j.title.toLowerCase().includes(q.toLowerCase()));
  const allOn = shown.length > 0 && shown.every((j) => sel.has(j.id));

  const del = async () => {
    if (!confirm(`Delete ${sel.size} transcript(s) and their media? This can't be undone.`)) return;
    await api.removeMany([...sel]);
    setSel(new Set());
    load();
  };

  return (
    <div className="library">
      <div className="lib-head">
        <h2>Library</h2>
        <input className="text search" placeholder="Filter by name" value={q} onChange={(e) => setQ(e.target.value)} />
        <a className="primary" href="#/">+ New</a>
      </div>

      {sel.size > 0 && (
        <div className="bulkbar">
          <span>{sel.size} selected</span>
          <select value={fmt} onChange={(e) => setFmt(e.target.value)}>
            {config.export_formats.map((f) => (
              <option key={f} value={f}>{f.toUpperCase()}</option>
            ))}
          </select>
          <button onClick={() => api.bulkExport([...sel], fmt, true, true).catch((e) => setErr(e.message))}>
            Download ZIP
          </button>
          <button className="danger" onClick={del}>Delete</button>
        </div>
      )}
      {err && <div className="banner error">{err}</div>}

      {jobs && jobs.length === 0 && (
        <div className="empty card">
          <p>Nothing here yet.</p>
          <a className="primary" href="#/">Transcribe your first file</a>
        </div>
      )}

      {shown.length > 0 && (
        <table className="jobs card">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={allOn}
                  onChange={() => setSel(allOn ? new Set() : new Set(shown.map((j) => j.id)))}
                />
              </th>
              <th>Name</th>
              <th>Status</th>
              <th>Length</th>
              <th>Language</th>
              <th>Added</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => (
              <tr key={j.id} className={j.status}>
                <td><input type="checkbox" checked={sel.has(j.id)} onChange={() => toggle(j.id)} /></td>
                <td className="name">
                  {j.status === "done" ? <a href={`#/t/${j.id}`}>{j.title}</a> : <span>{j.title}</span>}
                  <small className="muted">
                    {config.modes.find((m) => m.id === j.mode)?.label}
                    {j.diarize && " · speakers"}
                    {j.translate_to_english && " · to English"}
                    {j.clean_audio && " · cleaned"}
                  </small>
                </td>
                <td className="status">
                  <span className={`pill ${j.status}`}>{STATUS[j.status]}</span>
                  {j.status === "running" && (
                    <div className="bar" title={j.stage}>
                      <i style={{ width: `${Math.round(j.progress * 100)}%` }} />
                      <small>{j.stage} · {Math.round(j.progress * 100)}%</small>
                    </div>
                  )}
                  {j.status === "failed" && <small className="err" title={j.error || ""}>{j.error?.slice(0, 80)}</small>}
                </td>
                <td>{clock(j.duration)}</td>
                <td>{j.detected_language || j.language || "auto"}</td>
                <td className="muted">{new Date(/(Z|[+-]\d\d:\d\d)$/.test(j.created_at) ? j.created_at : j.created_at + "Z").toLocaleString()}</td>
                <td className="actions">
                  {j.status === "failed" && <button className="link" onClick={() => api.retry(j.id).then(load)}>retry</button>}
                  <button
                    className="link"
                    onClick={async () => {
                      if (confirm(`Delete “${j.title}”?`)) {
                        await api.remove(j.id);
                        load();
                      }
                    }}
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
