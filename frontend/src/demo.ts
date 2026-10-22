// Bundled sample used when no Murmur server is reachable (e.g. the static Vercel demo).
import type { Config, Job, Transcript } from "./api";
import original from "./demo-transcript.json";
import spanish from "./demo-transcript.es.json";

export const DEMO_ID = "demo";

export const demoTranscripts: Record<string, Transcript> = {
  "": original as Transcript,
  es: spanish as Transcript,
};

export const demoJob: Job = {
  id: DEMO_ID,
  title: "Weekly planning meeting (sample)",
  source_type: "file",
  source_url: null,
  original_filename: "two-voices.wav",
  media_file: "sample.mp3",
  status: "done",
  stage: "Done",
  progress: 1,
  error: null,
  language: null,
  detected_language: "en",
  mode: "steady",
  diarize: true,
  num_speakers: -1,
  translate_to_english: false,
  clean_audio: false,
  diarization_method: "ecapa",
  duration: 42.08,
  speakers: { SPEAKER_00: "Host", SPEAKER_01: "QA Lead" },
  created_at: "2026-10-22T13:59:02Z",
  finished_at: "2026-10-22T13:59:14Z",
  has_media: true,
  translations: ["es"],
};

const LANGS: [string, string][] = [
  ["en", "English"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["it", "Italian"], ["pt", "Portuguese"],
  ["nl", "Dutch"], ["pl", "Polish"], ["ru", "Russian"], ["uk", "Ukrainian"], ["tr", "Turkish"], ["ar", "Arabic"],
  ["hi", "Hindi"], ["bn", "Bengali"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"], ["vi", "Vietnamese"],
  ["id", "Indonesian"], ["sv", "Swedish"],
];

export const demoConfig: Config = {
  languages: LANGS.map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name)),
  modes: [
    { id: "swift", label: "Swift", hint: "Fastest", model: "base" },
    { id: "steady", label: "Steady", hint: "Balanced", model: "small" },
    { id: "precise", label: "Precise", hint: "Most accurate", model: "large-v3-turbo" },
  ],
  default_mode: "steady",
  diarization_method: "ecapa",
  export_formats: ["txt", "docx", "pdf", "srt", "vtt", "csv", "json"],
  max_upload_mb: 0,
  demo: true,
};
