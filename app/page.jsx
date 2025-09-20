"use client";
import { useEffect, useRef, useState } from "react";

const DEFAULT_ASPECT = process.env.NEXT_PUBLIC_DEFAULT_ASPECT || "9:16";
const DEFAULT_QUALITY = process.env.NEXT_PUBLIC_DEFAULT_QUALITY || "1080p";

export default function Home() {
  const [phrase, setPhrase] = useState("you");
  const [aspect, setAspect] = useState(DEFAULT_ASPECT);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);

  const [caps, setCaps] = useState({ pexels: false, ai_cf: false, ai_hf: false });
  const [source, setSource] = useState("placeholder"); // auto-set after caps load

  const [overlay, setOverlay] = useState(true);
  const [zoom, setZoom] = useState(true); // kept for compatibility (not used in latest server)
  const [karaoke, setKaraoke] = useState(true);

  const [busy, setBusy] = useState("");
  const [job, setJob] = useState({ id: "", status: "", url: "" });
  const [errMsg, setErrMsg] = useState("");

  // Progress/ETA
  const [progress, setProgress] = useState(0);
  const [progressTarget, setProgressTarget] = useState(0);
  const [etaLeftSec, setEtaLeftSec] = useState(0);
  const [jobKind, setJobKind] = useState("quick"); // "quick" | "montage" | "smoke"

  const startRef = useRef(0);
  const lastStatusRef = useRef("");
  const estTotalMsRef = useRef(25000);
  const progressTimerRef = useRef(null);

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

  // Smoothly animate progress toward progressTarget
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= progressTarget) return prev;
        const step = prev < 50 ? 2 : 1; // speed up early, slow down later
        return Math.min(progressTarget, prev + step);
      });

      // Update ETA based on elapsed vs estimate
      if (startRef.current && estTotalMsRef.current > 0) {
        const elapsedMs = Date.now() - startRef.current;
        const left = Math.max(0, Math.ceil((estTotalMsRef.current - elapsedMs) / 1000));
        setEtaLeftSec(left);
      }
    }, 180);

    return () => clearInterval(progressTimerRef.current);
  }, [progressTarget]);

  // Poll Shotstack status
  async function poll(id) {
    const sr = await fetch(`/api/render/status?id=${id}`);
    const sj = await sr.json();
    if (sj.error) {
      setErrMsg(sj.error);
      setBusy("");
      return;
    }

    setJob((prev) => ({ ...prev, status: sj.status, url: sj.url || "" }));

    // Map status to progress target
    const status = String(sj.status || "").toLowerCase();
    lastStatusRef.current = status;

    // Stage-based floor targets
    let target = progressTarget;
    if (status.includes("queued")) target = Math.max(target, 10);
    else if (status.includes("fetch")) target = Math.max(target, 20);
    else if (status.includes("render")) {
      // During rendering, drive target with time-based estimate
      const elapsed = Date.now() - startRef.current;
      const pctTime = Math.min(0.98, elapsed / estTotalMsRef.current); // cap at 98%
      const dynamicTarget = 25 + Math.round(pctTime * 65); // 25% → 90%
      target = Math.max(target, dynamicTarget);
    } else if (status.includes("save")) target = Math.max(target, 95);
    else if (status.includes("done")) target = 100;
    setProgressTarget(target);

    if (status === "done" || status === "failed" || status === "cancelled") {
      setBusy("");
      if (status !== "done") setErrMsg(`Render ${status}`);
      setProgress(100);
      setEtaLeftSec(0);
      return;
    }

    // Keep polling
    setTimeout(() => poll(id), 2500);
  }

  function estimateTotalMs(kind, src, qual) {
    // Heuristic estimates so users see a realistic countdown
    // Base times (in seconds)
    let base = 18; // placeholder/pexels quick4s
    if (src === "ai") base = 38;
    if (kind === "montage") base += 6; // montage needs more time
    if (qual === "1080p") base *= 1.2; // 1080 a bit slower
    return Math.round(base * 1000);
  }

  async function run(path, body, kind) {
    setErrMsg("");
    setBusy("Creating render…");
    setJob({ id: "", status: "queued", url: "" });

    // Init progress + ETA
    setProgress(3);
    setProgressTarget(8);
    setJobKind(kind);
    startRef.current = Date.now();
    estTotalMsRef.current = estimateTotalMs(kind, source, quality);
    setEtaLeftSec(Math.ceil(estTotalMsRef.current / 1000));

    const r = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) {
      setBusy("");
      setErrMsg(j?.detail ? JSON.stringify(j.detail) : (j?.error || "Render create failed"));
      return;
    }

    setJob({ id: j.id, status: "queued", url: "" });
    setBusy("Rendering…");
    setProgressTarget(12);
    poll(j.id);
  }

  const quick4s = async () => {
    if (!phrase.trim()) return alert("Type a word");
    await run("/api/quick4s", { phrase, aspect, quality, source, overlay, karaoke }, "quick");
  };

  const montage4 = async () => {
    if (!phrase.trim()) return alert("Type a word");
    await run("/api/montage", { phrase, aspect, quality, source, overlay, karaoke, count: 4 }, "montage");
  };

  const testShotstack = async () => {
    await run("/api/smoke", { aspect, quality }, "smoke");
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
              <button className={`btn ${source === "pexels" ? "btn-accent" : "btn-muted"}`} onClick={() => setSource("pexels")} disabled={!caps.pexels} title={!caps.pexels ? "Add PEXELS_API_KEY to enable" : ""}>Pexels</button>
              <button className={`btn ${source === "placeholder" ? "btn-accent" : "btn-muted"}`} onClick={() => setSource("placeholder")}>Placeholder</button>
              <button className={`btn ${source === "ai" ? "btn-accent" : "btn-muted"}`} onClick={() => setSource("ai")} disabled={!caps.ai_cf && !caps.ai_hf} title={!caps.ai_cf && !caps.ai_hf ? "Add CF_* or HF_TOKEN to enable AI" : (caps.ai_cf ? "Cloudflare AI" : "Hugging Face AI")}>AI</button>
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="text-sm text-white/70 mb-1">Options</div>
            <div className="flex flex-wrap gap-2">
              <button className={`btn ${overlay ? "btn-accent" : "btn-muted"}`} onClick={() => setOverlay((v) => !v)}>Word overlay {overlay ? "On" : "Off"}</button>
              <button className={`btn ${karaoke ? "btn-accent" : "btn-muted"}`} onClick={() => setKaraoke((v) => !v)}>Highlight sweep {karaoke ? "On" : "Off"}</button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-accent" onClick={quick4s}>Quick 4s</button>
          <button className="btn btn-primary" onClick={montage4}>Montage (4 × 1s)</button>
          <button className="btn btn-muted" onClick={testShotstack} title="2s sanity check">Test Shotstack</button>
        </div>

        {busy && <div className="text-sm text-white/70">{busy}</div>}
        {errMsg && <div className="text-sm text-red-300 break-words">Error: {errMsg}</div>}
      </section>

      <section className="glass p-4 md:p-6 shadow-soft space-y-3">
        <h2 className="text-lg font-semibold">Preview</h2>

        {/* Progress/ETA panel always visible when a job is active */}
        {job.id && (
          <div className="space-y-2">
            <div className="w-full h-2 bg-white/10 rounded overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-brand-purple to-brand-pink"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%`, transition: "width 0.18s ease" }}
              />
            </div>
            <div className="text-sm text-white/70">
              {job.status ? `Status: ${job.status}` : "Status: queued"} · {Math.round(progress)}% {etaLeftSec > 0 ? `· ~${etaLeftSec}s left` : ""}
            </div>
          </div>
        )}

        {job.url ? (
          <>
            <video src={job.url} className="w-full rounded-lg border border-white/10" controls />
            <div className="text-xs">
              <a className="underline" href={job.url} target="_blank" rel="noreferrer">Open MP4</a>
            </div>
          </>
        ) : !job.id ? (
          <div className="text-sm text-white/50">No render yet. Type a word and click Quick 4s or Montage.</div>
        ) : null}
      </section>

      <footer className="text-center text-white/50 text-xs pt-2">
        Type a word → Quick 4s or Montage → Done
      </footer>
    </main>
  );
}
