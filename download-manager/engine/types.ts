export type Status =
  | 'queued'        // waiting for the queue to pick it up
  | 'downloading'
  | 'paused'
  | 'verifying'     // hashing after the last byte arrived
  | 'completed'
  | 'error';

/** A byte range [start, end) of the target file; pos is the next byte to fetch. */
export interface Segment {
  start: number;
  end: number;
  pos: number;
}

export interface Checksum {
  /** Optional expected value, e.g. "sha256:abcd…" or "md5:…". */
  expected?: string;
  sha256?: string;
  md5?: string;
  /** null until checked; true/false once an expected value was compared. */
  match?: boolean | null;
}

export interface HlsState {
  /** Media playlist chosen from a master playlist (absent for a direct media playlist). */
  variant?: string;
  label?: string;
  /** Segments across all tracks (video + separate audio). */
  total: number;
  done: number;
  bytes: number;
}

export interface YtdlpState {
  /** yt-dlp -f selector, e.g. "bv*[height<=720]+ba/b[height<=720]/b". */
  format: string;
  label: string;
  audioOnly: boolean;
  approxSize?: number | null;
  /** Page cookies from the browser (Netscape file written per run, then deleted). */
  cookies?: import('./ytdlp.ts').BrowserCookie[];
  downloaded: number;
  total: number;
  phase?: 'downloading' | 'merging' | 'done';
}

export interface DownloadRecord {
  id: string;
  /** 'file' = one HTTP resource (default); 'hls' = an unencrypted HLS stream; 'ytdlp' = handed to yt-dlp. */
  kind?: 'file' | 'hls' | 'ytdlp';
  hls?: HlsState;
  ytdlp?: YtdlpState;
  /** Page the download came from (browser extension). */
  pageUrl?: string;
  url: string;
  fileName: string;
  /** True when the user typed the name; otherwise the server's name wins. */
  fileNameLocked: boolean;
  dir: string;
  category: string;
  size: number | null;
  resumable: boolean;
  status: Status;
  error?: string;
  segments: Segment[];
  connections: number;
  /** Bytes per second, 0 = unlimited. */
  speedLimit: number;
  inQueue: boolean;
  addedAt: number;
  completedAt?: number;
  etag?: string;
  lastModified?: string;
  headers?: Record<string, string>;
  checksum: Checksum;
  description?: string;
  log: string[];
}

export interface Category {
  name: string;
  exts: string[];
  dir: string;
}

export interface Settings {
  baseDir: string;
  connections: number;
  maxConcurrent: number;
  globalSpeedLimit: number;
  categories: Category[];
  /** First-run setup finished (the UI shows the welcome dialog until then). */
  onboarded?: boolean;
  /** When true, cross-site callers (the browser extension) must pair; the app's own UI is exempt. */
  requirePairing?: boolean;
  /** Daily check of GitHub Releases for a newer version. On by default; no data is sent. */
  updateCheck?: boolean;
  scheduler: {
    enabled: boolean;
    startAt: string;   // "HH:MM", local time, daily
    stopAt: string;    // "" = no stop time
    onDone: 'none' | 'exit' | 'shutdown';
  };
}

/** Live numbers that are not persisted. */
export interface LiveStats {
  speed: number;
  downloaded: number;
  connections: { start: number; end: number; pos: number; speed: number }[];
}
