import { useEffect, useRef, useState } from 'react'

/** Wipe handle shared by image and video comparisons. */
function useWipe() {
  const [pos, setPos] = useState(50)
  const ref = useRef(null)
  const drag = useRef(false)
  useEffect(() => {
    const move = (e) => {
      if (!drag.current || !ref.current) return
      const r = ref.current.getBoundingClientRect()
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left
      setPos(Math.max(0, Math.min(100, (x / r.width) * 100)))
    }
    const up = () => { drag.current = false }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])
  const start = (e) => { drag.current = true; e.preventDefault() }
  return { pos, ref, start }
}

function Handle({ pos, start }) {
  return (
    <>
      <div className="wipe-line" style={{ left: `${pos}%` }} />
      <button className="wipe-knob" style={{ left: `${pos}%` }} onPointerDown={start} aria-label="Drag to compare">
        ◀▶
      </button>
      <span className="tag tag-l">Original</span>
      <span className="tag tag-r">Clarion</span>
    </>
  )
}

const ZOOMS = [['Fit', 0], ['100%', 1], ['200%', 2]]

export function ImageCompare({ before, after, width, height }) {
  const { pos, ref, start } = useWipe()
  const [zoom, setZoom] = useState(0)
  const style = zoom ? { width: width * zoom, height: height * zoom } : { aspectRatio: `${width}/${height}` }
  return (
    <div className="compare-wrap">
      <div className="zoombar">
        {ZOOMS.map(([l, z]) => (
          <button key={l} className={zoom === z ? 'chip on' : 'chip'} onClick={() => setZoom(z)}>{l}</button>
        ))}
      </div>
      <div className={zoom ? 'stage scroll' : 'stage'}>
        <div className={zoom ? 'layers' : 'layers fit'} style={style} ref={ref}>
          <img src={after} alt="Upscaled" draggable={false} style={{ imageRendering: zoom ? 'pixelated' : 'auto' }} />
          <img src={before} alt="Original" draggable={false} className="before"
            style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, imageRendering: zoom ? 'pixelated' : 'auto' }} />
          <Handle pos={pos} start={start} />
        </div>
      </div>
    </div>
  )
}

export function VideoCompare({ before, after, width, height }) {
  const { pos, ref, start } = useWipe()
  const a = useRef(null)
  const b = useRef(null)
  const [mode, setMode] = useState('wipe')
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)

  useEffect(() => {
    let raf
    const sync = () => {
      const va = a.current, vb = b.current
      if (va && vb && Math.abs(vb.currentTime - va.currentTime) > 0.06) vb.currentTime = va.currentTime
      if (va) setT(va.currentTime)
      raf = requestAnimationFrame(sync)
    }
    raf = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(raf)
  }, [])

  const toggle = () => {
    const va = a.current, vb = b.current
    if (!va) return
    if (va.paused) { va.play(); vb?.play(); setPlaying(true) } else { va.pause(); vb?.pause(); setPlaying(false) }
  }
  const seek = (v) => { a.current.currentTime = v; if (b.current) b.current.currentTime = v }
  const vid = (r, src, cls, extra = {}) => (
    <video ref={r} src={`${src}#t=0.001`} muted playsInline loop className={cls} preload="auto" {...extra} />
  )

  return (
    <div className="compare-wrap">
      <div className="zoombar">
        {['wipe', 'side'].map((m) => (
          <button key={m} className={mode === m ? 'chip on' : 'chip'} onClick={() => setMode(m)}>
            {m === 'wipe' ? 'Wipe' : 'Side by side'}
          </button>
        ))}
      </div>
      {mode === 'wipe' ? (
        <div className="stage">
          <div className="layers fit" style={{ aspectRatio: `${width}/${height}` }} ref={ref}>
            {vid(a, after, '', { onLoadedMetadata: (e) => setDur(e.target.duration), onClick: toggle })}
            {vid(b, before, 'before', { style: { clipPath: `inset(0 ${100 - pos}% 0 0)` }, onClick: toggle })}
            <Handle pos={pos} start={start} />
          </div>
        </div>
      ) : (
        <div className="side">
          <figure>{vid(b, before, '', { onClick: toggle })}<figcaption>Original</figcaption></figure>
          <figure>{vid(a, after, '', { onLoadedMetadata: (e) => setDur(e.target.duration), onClick: toggle })}<figcaption>Clarion</figcaption></figure>
        </div>
      )}
      <div className="transport">
        <button className="play" onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
        <input type="range" min={0} max={dur || 0} step={0.01} value={t} onChange={(e) => seek(+e.target.value)} />
        <span className="mono">{t.toFixed(1)} / {dur.toFixed(1)}s</span>
      </div>
    </div>
  )
}
