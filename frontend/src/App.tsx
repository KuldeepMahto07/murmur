import { useEffect, useState } from "react";
import { api, Config } from "./api";
import UploadPage from "./UploadPage";
import LibraryPage from "./LibraryPage";
import TranscriptPage from "./TranscriptPage";

function useHash() {
  const [hash, setHash] = useState(location.hash || "#/");
  useEffect(() => {
    const on = () => setHash(location.hash || "#/");
    addEventListener("hashchange", on);
    return () => removeEventListener("hashchange", on);
  }, []);
  return hash;
}

export const go = (path: string) => (location.hash = path);

export default function App() {
  const hash = useHash();
  const [config, setConfig] = useState<Config | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.config().then(setConfig).catch((e) => setErr(String(e.message || e)));
  }, []);

  const m = hash.match(/^#\/t\/([\w]+)/);
  const page = m ? "transcript" : hash.startsWith("#/library") ? "library" : "upload";

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#/">
          <span className="brand-mark" aria-hidden>
            <i /><i /><i /><i />
          </span>
          Murmur
        </a>
        <nav>
          <a className={page === "upload" ? "on" : ""} href="#/">New transcript</a>
          <a className={page !== "upload" ? "on" : ""} href="#/library">Library</a>
        </nav>
      </header>
      <main>
        {err && <div className="banner error">Can't reach the Murmur server: {err}</div>}
        {config && page === "upload" && <UploadPage config={config} />}
        {config && page === "library" && <LibraryPage config={config} />}
        {config && page === "transcript" && m && <TranscriptPage id={m[1]} config={config} />}
      </main>
      <footer className="foot">Runs entirely on this computer · faster-whisper · {config?.diarization_method === "pyannote" ? "pyannote" : "ECAPA"} speaker labels</footer>
    </div>
  );
}
