import React, { useRef, useEffect, useState } from 'react';

/*
  MatchCut component:
  - canvas 720x1280 (vertical 9:16)
  - 4 scenes, total duration = 3200ms
  - automatic text scaling to fit
  - record to webm using MediaRecorder + canvas.captureStream()
*/

export default function MatchCut() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const [text, setText] = useState('YOUR WORD');
  const [input, setInput] = useState('YOUR WORD');
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const duration = 3200; // ms
  const width = 720;
  const height = 1280;

  // compute font size that fits the widest scene (gives some headroom)
  function computeFontSize(ctx, message) {
    if (!message) return 100;
    let targetMaxWidth = width * 0.78; // leave margins
    let fontSize = 220; // start large
    ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
    let metrics = ctx.measureText(message).width;
    while (metrics > targetMaxWidth && fontSize > 20) {
      fontSize -= 4;
      ctx.font = `${fontSize}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      metrics = ctx.measureText(message).width;
    }
    return fontSize;
  }

  // draw one frame at time t (ms since start)
  function draw(ctx, t, message) {
    // clear
    ctx.clearRect(0, 0, width, height);
    // which scene
    const sceneDur = duration / 4; // 800ms each
    const sceneIndex = Math.min(3, Math.floor(t / sceneDur));
    const sceneProgress = Math.min(1, (t - sceneIndex * sceneDur) / sceneDur);

    // base font size computed once per draw
    const baseFont = computeFontSize(ctx, message);

    // center point
    const cx = width / 2;
    const cy = height / 2;

    // Draw backgrounds and text per scene
    if (sceneIndex === 0) {
      // Scene 0: black bg -> white text scale-in
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const scale = 0.9 + 0.18 * sceneProgress; // 0.9 -> 1.08
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.fillText(message, 0, 0);
      ctx.restore();
    } else if (sceneIndex === 1) {
      // Scene 1: quick highlight slide under text
      ctx.fillStyle = '#111217';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;

      // measure text width
      const tw = ctx.measureText(message).width;
      const pad = 28;
      const rectW = tw + pad;
      const rectH = baseFont * 0.92;

      // highlight sliding in from left to right
      const slide = sceneProgress; // 0 -> 1
      const rectX = cx - rectW / 2;
      const shownW = rectW * slide;

      // draw highlight
      ctx.fillStyle = '#f4d35e';
      roundRect(ctx, rectX, cy - rectH / 2, shownW, rectH, 18, true, false);

      // text sits above highlight
      ctx.fillStyle = '#0b0b0b';
      ctx.fillText(message, cx, cy);
      ctx.restore();
    } else if (sceneIndex === 2) {
      // Scene 2: split scale - text shrinks then grows with gradient
      ctx.fillStyle = '#0f1724';
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const midScale = Math.abs(1 - sceneProgress * 2); // 1 -> 0 -> 1 but we'll animate scale in/out
      const scale = 0.6 + 0.9 * (1 - Math.abs(0.5 - sceneProgress) * 2); // pop effect
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // gradient fill
      const grad = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
      grad.addColorStop(0, '#a78bfa');
      grad.addColorStop(0.5, '#60a5fa');
      grad.addColorStop(1, '#34d399');

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = grad;
      ctx.font = `800 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.globalAlpha = 0.5 + 0.5 * (1 - Math.abs(0.5 - sceneProgress) * 2); // fade in/out a bit
      ctx.fillText(message, 0, 0);
      ctx.restore();
    } else {
      // Scene 3: quick punch with scale out and slight vignette
      // background gradient
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, '#080808');
      g.addColorStop(1, '#1b1b1b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      const punch = 1 + 0.6 * (1 - Math.pow(1 - sceneProgress, 2)); // 1 -> 1.6
      ctx.translate(cx, cy);
      ctx.scale(punch, punch);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.font = `900 ${baseFont}px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif`;
      ctx.fillText(message, 0, 0);
      ctx.restore();

      // subtle vignette
      const v = ctx.createRadialGradient(cx, cy, width * 0.2, cx, cy, width);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, width, height);
    }

    // small watermark at bottom right
    ctx.save();
    ctx.font = '14px Inter, system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'right';
    ctx.fillText('match-cut', width - 18, height - 18);
    ctx.restore();
  }

  // helper: rounded rect
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (w < 0) { x = x + w; w = Math.abs(w); }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // animation loop (plays once)
  function playOnce() {
    if (playing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    setPlaying(true);
    startRef.current = null;

    function loop(timestamp) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const t = Math.min(elapsed, duration);
      draw(ctx, t, text);
      if (elapsed < duration) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        setPlaying(false);
        startRef.current = null;
        cancelAnimationFrame(rafRef.current);
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }

  // start animation + record
  async function recordToWebm() {
    if (recording) return;
    const canvas = canvasRef.current;
    if (!canvas.captureStream) {
      alert('Recording not supported in this browser. Use Chrome on Android/desktop for best results.');
      return;
    }

    setRecording(true);
    const stream = canvas.captureStream(30); // 30fps
    let options = { mimeType: 'video/webm;codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
    }
    const recorder = new MediaRecorder(stream, options);
    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      // trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `match-cut-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setRecording(false);
    };

    // start recorder and then animation
    recorder.start();
    // small delay to ensure stream ready
    await new Promise((res) => setTimeout(res, 50));
    // play once, but stop recorder after duration
    playOnce();
    setTimeout(() => {
      try {
        recorder.stop();
      } catch (err) {
        // ignore
        setRecording(false);
      }
    }, duration + 120); // slight buffer
  }

  useEffect(() => {
    // initial draw static frame
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    // high DPI handling
    const ratio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${Math.floor((width / 2) / 1)}px`; // show smaller on page; user sees bigger on fullscreen
    canvas.style.height = `${Math.floor((height / 2) / 1)}px`;
    ctx.scale(ratio, ratio);
    draw(ctx, 0, text);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // handle pressing Generate / Play
  function handleGenerate() {
    const val = input.trim() || ' ';
    setText(val);
    // slight delay to let text set
    setTimeout(() => playOnce(), 50);
  }

  // quick keyboard enter
  function onKeyDown(e) {
    if (e.key === 'Enter') handleGenerate();
  }

  return (
    <div className="matchcut-root">
      <div className="canvas-wrap">
        <canvas ref={canvasRef} className="match-canvas" />
      </div>

      <div className="controls">
        <input
          className="text-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type any word or phrase..."
        />
        <div className="btn-row">
          <button className="btn" onClick={handleGenerate} disabled={playing || recording}>
            {playing ? 'Playing…' : 'Generate & Play'}
          </button>
          <button className="btn secondary" onClick={recordToWebm} disabled={playing || recording}>
            {recording ? 'Recording…' : 'Export .webm'}
          </button>
        </div>
        <p className="note">Tip: long phrases auto-scale to fit. If recording fails, try Chrome on Android/desktop.</p>
      </div>

      <style jsx>{`
        .matchcut-root { display:flex; flex-direction:column; gap:12px; align-items:center; }
        .canvas-wrap { background: #0b0b0b; border-radius:10px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.5); }
        .match-canvas { display:block; width: 300px; height: 533px; } /* scaled preview 9:16 */
        .controls { width: 100%; max-width: 480px; margin-top: 8px; display:flex; flex-direction:column; gap:8px; padding: 0 8px; }
        .text-input { width:100%; padding:12px 14px; border-radius:8px; border:1px solid #333; background:#111; color:#fff; outline:none; font-size:16px; }
        .btn-row { display:flex; gap:8px; }
        .btn { flex:1; padding:12px; border-radius:8px; border:none; background:#6b21a8; color:white; font-weight:700; }
        .btn.secondary { background:#111827; border:1px solid #333; }
        .btn:disabled { opacity:0.6; transform: none; cursor:not-allowed; }
        .note { color:#9ca3af; font-size:13px; margin-top:6px; }
      `}</style>
    </div>
  );
}
