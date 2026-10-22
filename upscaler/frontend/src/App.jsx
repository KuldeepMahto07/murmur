import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { ImageCompare, VideoCompare } from './Compare.jsx'

const IMG = /\.(png|jpe?g|webp|bmp|tiff?)$/i
const VID = /\.(mp4|mov|mkv|webm|avi|m4v)$/i

function Chips({ value, options, onChange, fmt = (v) => v }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={String(o)} className={String(value) === String(o) ? 'chip on' : 'chip'} onClick={() => onChange(o)}>
          {fmt(o)}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, onChange, disabled, hint }) {
  return (
    <label className={disabled ? 'slider off' : 'slider'}>
      <span>{label}<b className="mono">{Math.round(value * 100)}</b></span>
      <input type="range" min={0} max={1} step={0.01} value={value} disabled={disabled}
        onChange={(e) => onChange(+e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Settings({ opts, s, set, mode, setMode }) {
  const preset = opts.presets.find((p) => p.id === s.preset)
  return (
    <aside className="panel settings">
      <div className="seg">
        {['image', 'video'].map((m) => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'image' ? 'Image settings' : 'Video settings'}
          </button>
        ))}
      </div>

      <h4>Model</h4>
      <div className="presets">
        {opts.presets.map((p) => (
          <button key={p.id} className={s.preset === p.id ? 'preset on' : 'preset'} onClick={() => set({ preset: p.id })}>
            <strong>{p.label}</strong>
            <span>{p.blurb}</span>
          </button>
        ))}
      </div>

      {mode === 'image' ? (
        <>
          <h4>Scale</h4>
          <Chips value={s.scale} options={opts.image_scales} onChange={(v) => set({ scale: v })} fmt={(v) => `${v}×`} />
          <h4>Save as</h4>
          <Chips value={s.image_format} options={opts.image_formats} onChange={(v) => set({ image_format: v })}
            fmt={(v) => v.toUpperCase()} />
        </>
      ) : (
        <>
          <h4>Output size</h4>
          <Chips value={s.target || `x${s.scale}`}
            options={[...opts.video_scales.map((v) => `x${v}`), ...opts.video_targets]}
            onChange={(v) => (v.startsWith('x') ? set({ scale: +v.slice(1), target: null }) : set({ target: v, scale: null }))}
            fmt={(v) => (v.startsWith('x') ? `${v.slice(1)}×` : v === '4k' ? '4K' : v)} />
          <h4>Frame rate</h4>
          <Chips value={s.fps} options={opts.fps} onChange={(v) => set({ fps: v, slowmo: 1 })}
            fmt={(v) => (v === 'source' ? 'Keep' : `${v}`)} />
          <h4>Slow motion</h4>
          <Chips value={s.slowmo} options={opts.slowmo} onChange={(v) => set({ slowmo: v, fps: 'source' })}
            fmt={(v) => (v === 1 ? 'Off' : `${v}× slower`)} />
          <h4>Format</h4>
          <Chips value={s.codec} options={opts.codecs.map((c) => c.id)} onChange={(v) => set({ codec: v })}
            fmt={(v) => opts.codecs.find((c) => c.id === v).label} />
          <label className="toggle">
            <input type="checkbox" checked={s.preview} onChange={(e) => set({ preview: e.target.checked })} />
            <span>Preview only the first
              <input className="num mono" type="number" min={1} max={30} value={s.preview_seconds}
                onChange={(e) => set({ preview_seconds: +e.target.value })} /> s</span>
          </label>
        </>
      )}

      <h4>Fine-tune</h4>
      <Slider label="Noise cleanup" value={s.denoise} onChange={(v) => set({ denoise: v })}
        disabled={!preset?.supports_denoise} hint={preset?.supports_denoise ? null : 'Available on Balanced'} />
      <Slider label="Extra crispness" value={s.sharpen} onChange={(v) => set({ sharpen: v })} />
      <label className="toggle">
        <input type="checkbox" checked={s.faces} onChange={(e) => set({ faces: e.target.checked })} />
        <span>Recover faces</span>
      </label>
    </aside>
  )
}

function fmtSize(info) {
  return info?.width ? `${info.width}×${info.height}` : ''
}

function JobRow({ job, active, onClick }) {
  const pct = Math.round(job.progress * 100)
  return (
    <button className={active ? 'job on' : 'job'} onClick={onClick}>
      <div className="thumb">
        {job.kind === 'image' && job.urls.before ? <img src={job.urls.before} alt="" /> : <span>{job.kind === 'video' ? '▶' : '◻'}</span>}
      </div>
      <div className="meta">
        <div className="name" title={job.name}>{job.name}</div>
        <div className="sub mono">
          {fmtSize(job.info)}{job.result?.width ? ` → ${job.result.width}×${job.result.height}` : ''}
          {job.settings.preview ? ' · preview' : ''}
        </div>
        {job.status === 'running' || job.status === 'queued' ? (
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
        ) : (
          <div className={`status ${job.status}`}>{job.status === 'done' ? 'Ready' : job.status}</div>
        )}
      </div>
    </button>
  )
}

export default function App() {
  const [opts, setOpts] = useState(null)
  const [sys, setSys] = useState(null)
  const [jobs, setJobs] = useState([])
  const [sel, setSel] = useState(null)
  const [mode, setMode] = useState('image')
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const fileRef = useRef(null)
  const set = (patch) => setS((p) => ({ ...p, ...patch }))

  useEffect(() => {
    api.options().then((o) => { setOpts(o); setS(o.defaults) })
    api.system().then(setSys)
  }, [])

  const refresh = useCallback(() => api.jobs().then(setJobs).catch(() => {}), [])
  useEffect(() => { refresh() }, [refresh])
  const busy = jobs.some((j) => j.status === 'queued' || j.status === 'running')
  useEffect(() => {
    if (!busy) return
    const t = setInterval(refresh, 800)
    return () => clearInterval(t)
  }, [busy, refresh])

  const upload = async (files) => {
    setErr('')
    for (const f of files) {
      const kind = IMG.test(f.name) ? 'image' : VID.test(f.name) ? 'video' : null
      if (!kind) { setErr(`${f.name}: unsupported file type`); continue }
      const settings = kind === 'image' ? { ...s, scale: s.scale || 4, target: null } : s
      try {
        const job = await api.create(f, settings)
        setSel(job.id)
        setMode(kind)
      } catch (e) { setErr(`${f.name}: ${e.message}`) }
    }
    refresh()
  }

  const job = jobs.find((j) => j.id === sel) || jobs[0]
  const rerun = async (patch) => {
    const r = await api.rerun(job.id, { ...s, ...patch })
    setSel(r.id); refresh()
  }

  if (!opts || !s) return <div className="boot">Starting Clarion…</div>

  return (
    <div className="app"
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={(e) => { if (e.target === e.currentTarget) setOver(false) }}
      onDrop={(e) => { e.preventDefault(); setOver(false); upload([...e.dataTransfer.files]) }}>
      <header>
        <div className="brand"><svg viewBox="0 0 32 32" width="22" height="22"><path d="M6 24 L16 6 L26 24" stroke="currentColor" strokeWidth="3.2" fill="none" strokeLinejoin="round" /></svg>Clarion</div>
        <div className="sys mono">
          {sys ? (sys.device === 'cuda' ? `GPU · ${sys.name} · ${sys.vram_gb} GB` : 'CPU mode (slow)') : '…'}
        </div>
      </header>

      <aside className="panel queue">
        <button className="add" onClick={() => fileRef.current.click()}>+ Add images or videos</button>
        <input ref={fileRef} type="file" multiple hidden accept="image/*,video/*,.mkv,.mov"
          onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
        {err && <div className="err">{err}</div>}
        <div className="jobs">
          {jobs.map((j) => <JobRow key={j.id} job={j} active={job?.id === j.id} onClick={() => { setSel(j.id); setMode(j.kind) }} />)}
          {!jobs.length && <p className="empty">Your queue is empty.</p>}
        </div>
      </aside>

      <main className="viewer">
        {!job ? (
          <div className={over ? 'drop over' : 'drop'} onClick={() => fileRef.current.click()}>
            <div className="drop-in">
              <svg viewBox="0 0 48 48" width="44" height="44"><path d="M24 32V10m0 0-8 8m8-8 8 8M10 34v4h28v-4" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <h2>Drop photos or clips to sharpen them</h2>
              <p>PNG · JPG · WebP · TIFF · MP4 · MOV · MKV · WebM — everything runs on this computer.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="viewer-head">
              <div>
                <h3 title={job.name}>{job.name}</h3>
                <div className="sub mono">
                  {fmtSize(job.info)}{job.info?.fps ? ` · ${job.info.fps.toFixed(2)} fps · ${job.info.duration.toFixed(1)} s` : ''}
                  {job.result?.width ? `  →  ${job.result.width}×${job.result.height}` : ''}
                  {job.result?.seconds ? ` · ${job.result.frames} frames in ${job.result.seconds}s` : ''}
                </div>
              </div>
              <div className="actions">
                {(job.status === 'running' || job.status === 'queued') && <button className="ghost" onClick={() => api.cancel(job.id).then(refresh)}>Cancel</button>}
                {job.kind === 'video' && job.settings.preview && job.status === 'done' &&
                  <button className="primary" onClick={() => rerun({ preview: false })}>Render full video</button>}
                {job.status !== 'running' && job.status !== 'queued' &&
                  <button className="ghost" onClick={() => rerun({})} title="Run this file again with the settings on the right">Re-run with current settings</button>}
                {job.status === 'done' && <a className="primary" href={`${job.urls.output}?download=true`}>Download</a>}
                <button className="ghost danger" onClick={() => api.remove(job.id).then(() => { setSel(null); refresh() })}>Remove</button>
              </div>
            </div>
            {job.status === 'done' ? (
              job.kind === 'image'
                ? <ImageCompare key={job.id} before={job.urls.before} after={job.urls.after} width={job.result.width} height={job.result.height} />
                : <VideoCompare key={job.id} before={job.urls.before} after={job.urls.after} width={job.result.width} height={job.result.height} />
            ) : (
              <div className="working">
                {job.status === 'error' || job.status === 'cancelled' ? (
                  <p className={`status ${job.status}`}>{job.message}</p>
                ) : (
                  <>
                    <div className="ring" style={{ '--p': job.progress }}><span className="mono">{Math.round(job.progress * 100)}%</span></div>
                    <p className="mono">{job.message}</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {over && job && <div className="drop-overlay">Drop to add to queue</div>}
      </main>

      <Settings opts={opts} s={s} set={set} mode={mode} setMode={setMode} />
    </div>
  )
}
