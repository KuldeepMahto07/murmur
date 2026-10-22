import { DEMO_ID, demoConfig, demoJob, demoTranscripts } from "./demo";

export type Job = {
  id: string;
  title: string;
  source_type: "file" | "url";
  source_url: string | null;
  original_filename: string | null;
  media_file: string | null;
  status: "queued" | "running" | "done" | "failed";
  stage: string;
  progress: number;
  error: string | null;
  language: string | null;
  detected_language: string | null;
  mode: string;
  diarize: boolean;
  num_speakers: number;
  translate_to_english: boolean;
  clean_audio: boolean;
  diarization_method: string | null;
  duration: number | null;
  speakers: Record<string, string>;
  created_at: string;
  finished_at: string | null;
  has_media: boolean;
  translations: string[];
};

export type Word = { start: number; end: number; word: string; speaker?: string };
export type Segment = {
  id: number;
  start: number;
  end: number;
  text: string;
  speaker: string | null;
  words: Word[];
  edited?: boolean;
};
export type Transcript = { language: string; source_language?: string; duration: number; segments: Segment[] };

export type Config = {
  languages: { code: string; name: string }[];
  modes: { id: string; label: string; hint: string; model: string }[];
  default_mode: string;
  diarization_method: "pyannote" | "ecapa";
  export_formats: string[];
  max_upload_mb: number;
  demo?: boolean;
};

export type Options = {
  language: string;
  mode: string;
  diarize: boolean;
  num_speakers: number;
  translate_to_english: boolean;
  clean_audio: boolean;
};

// Where the Murmur server lives. Empty = same origin (local install). Set VITE_API_URL at build time
// to point a hosted front end at a server elsewhere.
export const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) || "").replace(/\/$/, "");

// Demo mode: no server reachable, so the UI serves the bundled sample read-only.
export let demoMode = false;
const DEMO_MSG = "This is a demo without a transcription server. Run Murmur locally to transcribe your own files.";
const demoOnly = <T>(): Promise<T> => Promise.reject(new Error(DEMO_MSG));

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(API_BASE + url, init);
  if (!r.ok) {
    let msg = r.statusText;
    try {
      const j = await r.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return r.json();
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  async config(): Promise<Config> {
    try {
      const r = await fetch(API_BASE + "/api/config");
      if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) throw new Error();
      return await r.json();
    } catch {
      demoMode = true;
      return demoConfig;
    }
  },
  jobs: () => (demoMode ? Promise.resolve([demoJob]) : req<Job[]>("/api/jobs")),
  job: (id: string) => (id === DEMO_ID ? Promise.resolve(demoJob) : req<Job>(`/api/jobs/${id}`)),
  mediaUrl: (id: string) => (id === DEMO_ID ? "/demo/sample.mp3" : `${API_BASE}/api/jobs/${id}/media`),
  upload(files: File[], o: Options, onProgress: (f: number) => void): Promise<Job[]> {
    if (demoMode) return demoOnly();
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    Object.entries(o).forEach(([k, v]) => fd.append(k, String(v)));
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open("POST", API_BASE + "/api/jobs");
      x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      x.onload = () => {
        if (x.status < 300) resolve(JSON.parse(x.responseText));
        else {
          try {
            reject(new Error(JSON.parse(x.responseText).detail));
          } catch {
            reject(new Error(x.statusText));
          }
        }
      };
      x.onerror = () => reject(new Error("Upload failed"));
      x.send(fd);
    });
  },
  fromUrl: (url: string, o: Options) => demoMode ? demoOnly<Job>() : req<Job>("/api/jobs/url", json("POST", { url, ...o })),
  patch: (id: string, body: { title?: string; speakers?: Record<string, string> }) =>
    id === DEMO_ID ? demoOnly<Job>() : req<Job>(`/api/jobs/${id}`, json("PATCH", body)),
  retry: (id: string) => req<Job>(`/api/jobs/${id}/retry`, { method: "POST" }),
  remove: (id: string) => id === DEMO_ID ? demoOnly() : req(`/api/jobs/${id}`, { method: "DELETE" }),
  removeMany: (ids: string[]) => demoMode ? demoOnly() : req("/api/jobs/bulk-delete", json("POST", { ids })),
  transcript: (id: string, lang?: string) =>
    id === DEMO_ID ? Promise.resolve(demoTranscripts[lang || ""]) : req<Transcript>(`/api/jobs/${id}/transcript${lang ? `?lang=${lang}` : ""}`),
  editSegments: (id: string, segments: { id: number; text?: string; speaker?: string }[]) =>
    id === DEMO_ID ? demoOnly<Transcript>() : req<Transcript>(`/api/jobs/${id}/transcript`, json("PUT", { segments })),
  translationLanguages: () => demoMode ? demoOnly<{ code: string; name: string }[]>() : req<{ code: string; name: string }[]>("/api/translate/languages"),
  translate: (id: string, target: string) => id === DEMO_ID ? demoOnly<Transcript>() : req<Transcript>(`/api/jobs/${id}/translate`, json("POST", { target })),
  exportUrl: (id: string, format: string, timestamps: boolean, speakers: boolean, lang?: string) =>
    id === DEMO_ID ? `/demo/sample.${format}` : `${API_BASE}/api/jobs/${id}/export?format=${format}&timestamps=${timestamps}&speakers=${speakers}${lang ? `&lang=${lang}` : ""}`,
  async bulkExport(ids: string[], format: string, timestamps: boolean, speakers: boolean) {
    if (demoMode) throw new Error(DEMO_MSG);
    const r = await fetch(API_BASE + "/api/export/bulk", json("POST", { ids, format, timestamps, speakers }));
    if (!r.ok) throw new Error((await r.json()).detail);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `murmur-export-${format}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
};

export function clock(t: number | null | undefined, ms = false): string {
  if (t == null || isNaN(t)) return "—";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const base = (h ? `${h}:${String(m).padStart(2, "0")}` : `${m}`) + `:${String(s).padStart(2, "0")}`;
  return ms ? `${base}.${String(Math.floor((t % 1) * 10))}` : base;
}

export function speakerName(id: string | null, names: Record<string, string>): string {
  if (!id) return "";
  if (names[id]) return names[id];
  const n = parseInt(id.split("_").pop() || "", 10);
  return isNaN(n) ? id : `Speaker ${n + 1}`;
}

export const SPEAKER_COLORS = ["#e8603c", "#2f8f83", "#6c5ce7", "#d4a017", "#c2185b", "#3f7fd6", "#7a8b2e", "#8d6e63"];
export function speakerColor(id: string | null): string {
  if (!id) return "#888";
  const n = parseInt(id.split("_").pop() || "0", 10);
  return SPEAKER_COLORS[(isNaN(n) ? 0 : n) % SPEAKER_COLORS.length];
}
