"use client";
import { useEffect, useState } from "react";

const LIBRARY_MODE = true;
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

export default function Home() {
  const [uploads, setUploads] = useState([]); // library items [{public_id, secure_url, duration}]
  const [aspect, setAspect] = useState(process.env.NEXT_PUBLIC_DEFAULT_ASPECT || "9:16");
  const [quality, setQuality] = useState(process.env.NEXT_PUBLIC_DEFAULT_QUALITY || "1080p");
  const [phrase, setPhrase] = useState("you");
  const [clipLen, setClipLen] = useState(3); // seconds: 2|3|4
  const [visualMatch, setVisualMatch] = useState(true);

  const [busy, setBusy] = useState("");
  const [transcripts, setTranscripts] = useState({}); // url -> { words, duration }
  const [segments, setSegments] = useState([]); // [{ url, so, eo, center, thumb }]
  const [renderJob, setRenderJob] = useState({ id: "", status: "", url: "" });

  // Load library on mount
  useEffect(() => {
    if (!LIBRARY_MODE) return;
    (async () => {
      try {
        setBusy("Loading library…");
        const r = await fetch("/api/library");
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        setUploads(j.items || []);
        setBusy("");
      } catch (e) {
        console.error(e);
        setBusy("");
        alert("Failed to load library");
      }
    })();
  }, []);

  const generate = async () => {
    try {
      if (uploads.length === 0) return alert("No clips in library yet.");
      if (!phrase.trim()) return alert("Type a word or phrase.");

      setRenderJob({ id: "", status: "", url: "" });
      setSegments([]);
      setBusy("Transcribing…");

      // 1) Transcribe (first 20 clips max for speed)
      const clips = uploads.slice(0, 20);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clips })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Transcribe failed");

      const map = {};
      for (const t of json.transcripts || []) {
        if (t.url && !t.error) map[t.url] = { words: t.words || [], duration: t.duration || 0 };
      }

      setTranscripts(map);
      setBusy("Finding matches…");

      // 2) Matches
      const p = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const total = Number(clipLen) || 3;
      const pre = Math.max(0.2, total / 2 - 0.2);
      const post = Math.max(0.2, total / 2 + 0.2);

      let hits = [];
      for (const u of clips) {
        const tr = map[u.secure_url];
        if (!tr) continue;
        const words = tr.words || [];

        if (p.length === 1) {
          for (const w of words) if (w.w === p[0]) hits.push({ url: u.secure_url, start: w.start, end: w.end });
        } else {
          for (let i = 0; i < words.length - p.length + 1; i++) {
            let ok = true;
            for (let k = 0; k < p.length; k++) {
              if (words[i + k]?.w !== p[k]) { ok = false; break; }
            }
            if (ok) {
              hits.push({
                url: u.secure_url,
                start: words[i].start,
                end: words[i + p.length - 1].end
              });
              i += p.length - 1;
            }
          }
        }
      }

      // 3) Build segments with padding and thumbs
      let segs = hits.map((h) => {
        const so = Math.max(0, h.start - pre);
        const eo = h.end + post;
        const center = (so + eo) / 2;
        return { url: h.url, so, eo, center };
      });

      // Limit for preview
      segs = segs.slice(0, 30);

      // Add thumbs and basic visual sort
      for (const s of segs) {
        s.thumb = frameThumbFromCloudinaryUrl(s.url, s.center);
        s.color = await avgColorFromImage(s.thumb).catch(() => [0, 0, 0]);
      }
      if (visualMatch && segs.length > 1) {
        segs = orderByVisualFlow(segs);
      }

      setSegments(segs);
      setBusy("");
    } catch (e) {
      console.error(e);
      setBusy("");
      alert(e.message || "Generate failed");
    }
  };

  const render = async () => {
    try {
      if (segments.length === 0) return alert("No segments to render.");
      setRenderJob({ id: "", status: "queued", url: "" });
      // Send minimal data to server
      const payload = {
        segments: segments.map((s) => ({ url: s.url, so: s.so, eo: s.eo })),
        aspect,
        quality
      };
      const r = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Render create failed");

      const id = j.id;
      setRenderJob({ id, status: "queued", url: "" });

      // Poll for status
      const poll = async () => {
        const sr = await fetch(`/api/render/status?id=${id}`);
        const sj = await sr.json();
        if (sj.error) throw new Error(sj.error);
        const status = sj.status;
        const url = sj.url || "";
        setRenderJob((prev) => ({ ...prev, status, url }));
        if (status === "done" || status === "failed" || status === "cancelled") return;
        setTimeout(poll, 3000);
      };
      poll();
    } catch (e) {
      console.error(e);
      alert(e.message || "Render failed");
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="text-2xl font-semibold">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-pink">
            MatchCut
          </span>{" "}
          <span className="text-white/50 text-sm align-super">beta</span>
        </div>
        <a className="text-white/60 hover:text-white/90 underline" href="https://github.com/" target="_blank" rel="noreferrer">GitHub</a>
      </header>

      {LIBRARY_MODE && (
        <section className="glass p-4 md:p-6 shadow-soft space-y-2">
          <div className="text-sm text-white/70">
            Library loaded: {uploads.length} clip(s) from Cloudinary (tagged “matchlib”). Type a word and Generate.
          </div>
        </section>
      )}

      <section className="glass p-4 md:p-6 shadow-soft space-y-4">
        <h2 className="text-lg font-semibold">Settings</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-white/70 mb-1">Aspect ratio</div>
            <div className="flex gap-2">
              <button className={`btn ${aspect === "9:16" ? "btn-accent" : "btn-muted"}`} onClick={() => setAspect("9:16")}>9:16</button>
              <button className={`btn ${aspect === "16:9" ? "btn-accent" : "btn-muted"}`} onClick={() => setAspect("16:9")}>16:9</button>
            </div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Quality</div>
            <div className="flex gap-2">
              <button className={`btn ${quality === "1080p" ? "btn-accent" : "btn-muted"}`} onClick={() => setQuality("1080p")}>1080p</button>
              <button className={`btn ${quality === "720p" ? "btn-accent" : "btn-muted"}`} onClick={() => setQuality("720p")}>720p</button>
            </div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Visual similarity</div>
            <div className="flex gap-2">
              <button className={`btn ${visualMatch ? "btn-accent" : "btn-muted"}`} onClick={() => setVisualMatch(true)}>On</button>
              <button className={`btn ${!visualMatch ? "btn-accent" : "btn-muted"}`} onClick={() => setVisualMatch(false)}>Off</button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="text-sm text-white/70 mb-1">Word or phrase</div>
            <input className="input" placeholder='e.g., "you", "beautiful", "moon"' value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Clip length</div>
            <div className="flex gap-2">
              {[2,3,4].map((n) => (
                <button key={n} className={`btn ${clipLen === n ? "btn-accent" : "btn-muted"}`} onClick={() => setClipLen(n)}>{n}s</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="glass p-4 md:p-6 shadow-soft space-y-3">
        <h2 className="text-lg font-semibold">Process</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-accent" onClick={generate}>Generate</button>
          <button className="btn btn-primary disabled:opacity-50" disabled={segments.length === 0} onClick={render}>Render</button>
        </div>
        {busy && <div className="text-sm text-white/70">{busy}</div>}
      </section>

      {segments.length > 0 && (
        <section className="glass p-4 md:p-6 shadow-soft space-y-3">
          <h2 className="text-lg font-semibold">Matches ({segments.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {segments.map((s, i) => (
              <div key={i} className="text-xs text-white/70">
                <div className="mb-1">
                  <img src={s.thumb} alt="" className="w-full h-28 object-cover rounded border border-white/10" />
                </div>
                <div>{s.so.toFixed(2)}s → {s.eo.toFixed(2)}s</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {renderJob.id && (
        <section className="glass p-4 md:p-6 shadow-soft space-y-2">
          <div className="text-sm">Render status: {renderJob.status || "queued"}</div>
          {renderJob.url && (
            <div className="text-sm">
              <a className="underline" href={renderJob.url} target="_blank" rel="noreferrer">Download MP4</a>
            </div>
          )}
        </section>
      )}

      <footer className="text-center text-white/50 text-xs pt-2">
        Type a word → Generate → Render
      </footer>
    </main>
  );
}

/* Helpers */

function frameThumbFromCloudinaryUrl(videoUrl, t) {
  const secs = Math.max(0, t || 0).toFixed(2);
  // insert so_{t} into /upload/
  const withSo = videoUrl.replace("/upload/", `/upload/so_${secs}/`);
  // deliver a jpg thumbnail from that frame
  return withSo.replace(/\.(mp4|mov|webm)(\?.*)?$/i, ".jpg$2");
}

function avgColorFromImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = 16, h = 16;
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
        resolve([Math.round(r / n), Math.round(g / n), Math.round(b / n)]);
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = src + (src.includes("?") ? "&" : "?") + "_=" + Date.now();
  });
}

function colorDist(a, b) {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return Math.sqrt(dr*dr + dg*dg + db*db);
}

function orderByVisualFlow(items) {
  if (items.length <= 1) return items;
  const out = [items[0]];
  const pool = items.slice(1);
  while (pool.length) {
    const last = out[out.length - 1];
    let bestIdx = 0, best = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const d = colorDist(last.color, pool[i].color);
      if (d < best) { best = d; bestIdx = i; }
    }
    out.push(pool.splice(bestIdx, 1)[0]);
  }
  return out;
}
