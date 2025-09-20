"use client";
import { useEffect, useState } from "react";

const DEFAULT_ASPECT = process.env.NEXT_PUBLIC_DEFAULT_ASPECT || "9:16";
const DEFAULT_QUALITY = process.env.NEXT_PUBLIC_DEFAULT_QUALITY || "1080p";

export default function Home() {
  const [phrase, setPhrase] = useState("you");
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  const [caps, setCaps] = useState({ pexels: false, ai_cf: false, ai_hf: false });
  const [source, setSource] = useState("placeholder"); // auto-picked after caps load

  const [overlay, setOverlay] = useState(true);
  const [zoom, setZoom] = useState(true);
  const [karaoke, setKaraoke] = useState(true);

  const [busy, setBusy] = useState("");
  const [job, setJob] = useState({ id: "", status: "", url: "" });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/capabilities");
        const j = await r.json();
        setCaps(j);
        if (j.ai_cf) setSource("ai");
        else if (j.ai_hf) setSource("ai");
        else if (j.pexels) setSource("pexels");
        else setSource("placeholder");
      } catch {
        setSource("placeholder");
      }
    })();
  }, []);

  async function poll(id) {
    const sr = await fetch(`/api/render/status?id=${id}`);
    const sj = await sr.json();
    if (sj.error) throw new Error(sj.error);
    setJob((prev) => ({ ...prev, status: sj.status, url: sj.url || "" }));
    if (sj.status === "done" || sj.status === "failed" || sj.status === "cancelled") {
      setBusy("");
      return;
    }
    setTimeout(() => poll(id), 2500);
  }

  async function run(path, body) {
    setBusy("Rendering…");
    setJob({ id: "", status: "queued", url: "" });
    const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Render create failed");
    setJob({ id: j.id, status: "queued", url: "" });
    poll(j.id);
  }

  const quick4s = async () => {
    try {
      if (!phrase.trim()) return alert("Type a word");
      setBusy("Creating 4s clip…");
      await run("/api/quick4s", { phrase, aspect, quality, source, overlay, zoom, karaoke });
    } catch (e) {
      console.error(e);
      setBusy("");
      alert(e.message || "Quick 4s failed");
    }
  };

  const montage4 = async () => {
    try {
      if (!phrase.trim()) return alert("Type a word");
      setBusy("Creating 4x1s montage…");
      await run("/api/montage", { phrase, aspect, quality, source, overlay, zoom, karaoke, count: 4 });
    } catch (e) {
      console.error(e);
      setBusy("");
      alert(e.message || "Montage failed");
    }
  };

  return (
    <main className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="text-2xl font-semibold">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-purple to-brand-pink">MatchCut</span>{" "}
          <span className="text-white/50 text-sm align-super">beta</span>
        </div>
        <div className="text-white/60 text-sm">Made By Tahsin</div>
      </header>

      <section className="glass p-4 md:p-6 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Generate</h2>
          <div className="text-xs text-white/60">
            Using: {source === "ai" ? (caps.ai_cf ? "AI (Cloudflare Workers AI)" : (caps.ai_hf ? "AI (Hugging Face)" : "AI (fallback)")) : source === "pexels" ? "Pexels" : "Placeholder"}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="text-sm text-white/70 mb-1">Word or phrase</div>
            <input className="input" placeholder='e.g., "you", "beautiful", "moon"' value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </div>

          <div>
            <div className="text-sm text-white/70 mb-1">Aspect</div>
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

          <div className="md:col-span-3">
            <div className="text-sm text-white/70 mb-1">Image source</div>
            <div className="flex gap-2">
              <button
                className={`btn ${source === "pexels" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setSource("pexels")}
                disabled={!caps.pexels}
                title={!caps.pexels ? "Add PEXELS_API_KEY to enable" : ""}
              >
                Pexels
              </button>
              <button
                className={`btn ${source === "placeholder" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setSource("placeholder")}
              >
                Placeholder
              </button>
              <button
                className={`btn ${source === "ai" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setSource("ai")}
                disabled={!caps.ai_cf && !caps.ai_hf}
                title={!caps.ai_cf && !caps.ai_hf ? "Add CF_* or HF_TOKEN to enable AI" : (caps.ai_cf ? "Cloudflare AI" : "Hugging Face AI")}
              >
                AI
              </button>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-sm text-white/70 mb-1">Options</div>
            <div className="flex flex-wrap gap-2">
              <button className={`btn ${overlay ? "btn-accent" : "btn-muted"}`} onClick={() => setOverlay((v) => !v)}>Word overlay {overlay ? "On" : "Off"}</button>
              <button className={`btn ${zoom ? "btn-accent" : "btn-muted"}`} onClick={() => setZoom((v) => !v)}>Zoom {zoom ? "On" : "Off"}</button>
              <button className={`btn ${karaoke ? "btn-accent" : "btn-muted"}`} onClick={() => setKaraoke((v) => !v)}>Highlight sweep {karaoke ? "On" : "Off"}</button>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-accent" onClick={quick4s}>Quick 4s</button>
          <button className="btn btn-primary" onClick={montage4}>Montage (4 × 1s)</button>
        </div>

        {busy && <div className="text-sm text-white/70">{busy}</div>}
      </section>

      {job.id && (
        <section className="glass p-4 md:p-6 shadow-soft space-y-3">
          <div className="text-sm">Status: {job.status || "queued"}</div>
          {job.url && (
            <>
              <video src={job.url} className="w-full rounded-lg border border-white/10" controls />
              <div className="text-xs">
                <a className="underline" href={job.url} target="_blank" rel="noreferrer">Open MP4</a>
              </div>
            </>
          )}
        </section>
      )}

      <footer className="text-center text-white/50 text-xs pt-2">
        Type a word → Quick 4s or Montage → Done
      </footer>
    </main>
  );
}
