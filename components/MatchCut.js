import React, { useRef, useEffect, useState } from 'react';

/**
 * MatchCut (UI v1)
 * - fixed visual preview 360x640 (CSS)
 * - internal canvas resolution 720x1280 for crisp export
 * - glass UI, improved buttons
 * - keeps same animation loop from prototype (we'll replace with premium template next)
 */

export default function MatchCut() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const [text, setText] = useState('YOUR WORD');
  const [input, setInput] = useState('YOUR WORD');
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);

  // configuration
  const DURATION = 3200; // ms
  const INTERNAL_W = 720;
  const INTERNAL_H = 1280;
  const PREVIEW_SCALE = 0.5; // visual 360x640

  // compute font size to fit
  function computeFontSize(ctx, message) {
    if (!message) return 140;
    const maxW = INTERNAL_W * 0.78;
    let fontSize = 220;
    ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
    let w = ctx.measureText(message).width;
    while (w > maxW && fontSize > 18) {
      fontSize -= 4;
      ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      w = ctx.measureText(message).width;
    }
    return fontSize;
  }

  // rounded rect helper
  function roundRect(ctx, x, y, w, h, r, fill) {
    if (w < 0) { x += w; w = Math.abs(w); }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
  }

  // draw frame
  function draw(ctx, t, message) {
    // treat t in [0, DURATION]
    ctx.clearRect(0, 0, INTERNAL_W, INTERNAL_H);
    const sceneDur = DURATION / 4;
    const idx = Math.min(3, Math.floor(t / sceneDur));
    const prog = Math.min(1, (t - idx * sceneDur) / sceneDur);
    const cx = INTERNAL_W / 2;
    const cy = INTERNAL_H / 2;
    const baseFont = computeFontSize(ctx, message);

    // background with subtle texture / gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, INTERNAL_H);
    bgGrad.addColorStop(0, '#07070a');
    bgGrad.addColorStop(1, '#0e0f13');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);

    // moving liquid sheen — faint ellipse that moves per time
    ctx.save();
    const sheenX = cx + Math.sin((t / DURATION) * Math.PI * 2) * (INTERNAL_W * 0.12);
    const sheenY = cy - INTERNAL_H * 0.25;
    const sheen = ctx.createRadialGradient(sheenX, sheenY, 10, sheenX, sheenY, INTERNAL_W * 0.9);
    sheen.addColorStop(0, 'rgba(255,255,255,0.025)');
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
    ctx.restore();

    // scenes approximating sample (punch / flash / pop)
    if (idx === 0) {
      // pop in with scale
      ctx.save();
      const scale = 0.85 + 0.35 * prog; // 0.85 -> 1.2
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `800 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.fillText(message, 0, 0);
      ctx.restore();
    } else if (idx === 1) {
      // flash frame + slide highlight
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;

      // flash (quick white frame at start of scene)
      if (prog < 0.08) {
        ctx.fillStyle = `rgba(255,255,255,${0.85 * (0.08 - prog) / 0.08})`;
        ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
      }

      // highlight bar slide
      const tw = ctx.measureText(message).width;
      const pad = 36;
      const rectW = tw + pad;
      const rectH = baseFont * 0.98;
      const shownW = rectW * Math.min(1, Math.max(0, (prog - 0.08) / 0.92)); // after flash
      const rectX = cx - rectW / 2;
      ctx.fillStyle = '#ffd166';
      roundRect(ctx, rectX, cy - rectH / 2, shownW, rectH, 20, true);

      // text above
      ctx.fillStyle = '#08101a';
      ctx.fillText(message, cx, cy);
      ctx.restore();
    } else if (idx === 2) {
      // gradient pop with slight rotation / split feel
      ctx.save();
      const rot = (prog - 0.5) * 0.08; // -0.04 -> 0.04
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      const scale = 0.78 + 0.6 * (1 - Math.abs(0.5 - prog) * 2);
      ctx.scale(scale, scale);

      const grad = ctx.createLinearGradient(-INTERNAL_W/2, 0, INTERNAL_W/2, 0);
      grad.addColorStop(0, '#ff7ab6');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#60a5fa');

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = grad;
      ctx.font = `800 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.globalAlpha = 0.95;
      ctx.fillText(message, 0, 0);
      ctx.restore();
    } else {
      // punch out with zoom + vignette
      ctx.save();
      const punch = 1 + 0.6 * (1 - Math.pow(1 - prog, 2)); // smooth
      ctx.translate(cx, cy);
      ctx.scale(punch, punch);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.fillText(message, 0, 0);
      ctx.restore();

      // vignette
      const v = ctx.createRadialGradient(cx, cy, INTERNAL_W * 0.18, cx, cy, INTERNAL_W);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, INTERNAL_W, INTERNAL_H);
    }

    // watermark
    ctx.save();
    ctx.font = '16px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.textAlign = 'right';
    ctx.fillText('match-cut', INTERNAL_W - 24, INTERNAL_H - 28);
    ctx.restore();
  }

  // animation loop
  function playOnce() {
    if (playing) return;
    setPlaying(true);
    setProgress(0);
    startRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    function loop(ts) {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(elapsed, DURATION);
      draw(ctx, t, text);
      setProgress(Math.floor((t / DURATION) * 100));
      if (elapsed < DURATION) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setPlaying(false);
        setProgress(100);
        startRef.current = null;
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => setProgress(0), 220);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  // record
  async function recordToWebm() {
    if (recording) return;
    const canvas = canvasRef.current;
    if (!canvas.captureStream) {
      alert('Recording not supported — try Chrome on Android or desktop.');
      return;
    }

    setRecording(true);
    setProgress(0);
    const stream = canvas.captureStream(30);
    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) options = { mimeType: 'video/webm' };
    }
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `match-cut-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setRecording(false);
      setProgress(0);
    };

    recorder.start();
    // small buffer to ensure stream warmed
    await new Promise((r) => setTimeout(r, 60));
    playOnce();
    // stop after duration + buffer
    const stopAt = DURATION + 140;
    const start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      setProgress(Math.min(100, Math.floor((elapsed / stopAt) * 100)));
      if (elapsed < stopAt) requestAnimationFrame(tick);
    };
    tick();
    setTimeout(() => {
      try { recorder.stop(); } catch (e) { setRecording(false); }
    }, stopAt);
  }

  useEffect(() => {
    // setup canvas (internal res + CSS scaled preview)
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const ratio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = INTERNAL_W * ratio;
    canvas.height = INTERNAL_H * ratio;
    canvas.style.width = `${Math.floor(INTERNAL_W * PREVIEW_SCALE)}px`;
    canvas.style.height = `${Math.floor(INTERNAL_H * PREVIEW_SCALE)}px`;
    // scale so drawing uses css pixels
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // initial draw
    draw(ctx, 0, text);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function handleGenerate() {
    const val = input.trim() || ' ';
    setText(val);
    // small delay to let text state update
    setTimeout(() => playOnce(), 40);
  }

  function onKey(e) {
    if (e.key === 'Enter') handleGenerate();
  }

  return (
    <div className="mc-root">
      <div className="stage">
        <canvas ref={canvasRef} className="mc-canvas" />
        <div className="liquid-sheen" aria-hidden />
      </div>

      <div className="controls glass">
        <input
          className="txt"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="Type any word or phrase..."
          aria-label="Text input"
        />

        <div className="row">
          <button className={`btn primary ${playing || recording ? 'disabled' : ''}`} onClick={handleGenerate} disabled={playing || recording}>
            {playing ? 'Playing…' : 'Generate & Play'}
          </button>
          <button className={`btn outline ${recording || playing ? 'disabled' : ''}`} onClick={recordToWebm} disabled={recording || playing}>
            {recording ? 'Recording…' : 'Export .webm'}
          </button>
        </div>

        <div className="progress-row">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="small muted">{progress ? `${progress}%` : ''}</div>
        </div>
      </div>

      <style jsx>{`
        .mc-root { display:flex; flex-direction:column; align-items:center; gap:12px; width:100%; }
        .stage { position:relative; border-radius:18px; overflow:hidden; box-shadow: 0 18px 45px rgba(6,6,10,0.6); border:1px solid rgba(255,255,255,0.04); }
        .mc-canvas { display:block; width:360px; height:640px; background:transparent; }
        .liquid-sheen { pointer-events:none; position:absolute; inset:0; background: linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.0)); mix-blend-mode: screen; }
        .controls { width:360px; padding:12px; border-radius:12px; display:flex; flex-direction:column; gap:10px; }
        .txt { width:100%; padding:12px 14px; border-radius:10px; border:1px solid rgba(255,255,255,0.06); background: rgba(10,10,12,0.45); color:#fff; outline:none; font-size:15px; }
        .row { display:flex; gap:10px; }
        .btn { flex:1; padding:11px; border-radius:10px; font-weight:700; border:none; cursor:pointer; transition: transform .12s ease, box-shadow .12s ease; }
        .btn.primary { background: linear-gradient(90deg,#7c3aed,#5b21b6); color:white; box-shadow: 0 8px 20px rgba(92,51,156,0.18); }
        .btn.outline { background: rgba(255,255,255,0.03); color:#fff; border:1px solid rgba(255,255,255,0.06); }
        .btn:active { transform: translateY(1px) scale(0.998); }
        .btn.disabled { opacity:0.6; pointer-events:none; transform:none; }
        .progress-row { display:flex; gap:8px; align-items:center; }
        .progress-bar { flex:1; height:8px; background: rgba(255,255,255,0.04); border-radius:999px; overflow:hidden; }
        .progress-fill { height:100%; background: linear-gradient(90deg,#60a5fa,#7c3aed); width:0%; transition: width .12s linear; }
        .small.muted { color: rgba(255,255,255,0.45); font-size:12px; min-width:44px; text-align:right; }
        .muted { color: rgba(255,255,255,0.52); font-size:12px; }
      `}</style>
    </div>
  );
}
