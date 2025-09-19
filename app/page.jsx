"use client";
import { useState } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "unsigned_video";

export default function Home() {
  const [uploads, setUploads] = useState([]); // [{public_id, secure_url, duration, bytes}]
  const [isUploading, setIsUploading] = useState(false);
  const [progressMap, setProgressMap] = useState({}); // filename -> 0..100
  const [aspect, setAspect] = useState(process.env.NEXT_PUBLIC_DEFAULT_ASPECT || "9:16");
  const [quality, setQuality] = useState(process.env.NEXT_PUBLIC_DEFAULT_QUALITY || "1080p");
  const [phrase, setPhrase] = useState("");
  const [visualMatch, setVisualMatch] = useState(true);

  const readyToTranscribe = uploads.length > 0 && CLOUD_NAME && UPLOAD_PRESET;

  const handleFilePick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      alert("Set your Cloudinary env vars in Vercel first.");
      return;
    }
    setIsUploading(true);
    for (const file of files) {
      await uploadToCloudinary(file, (pct) =>
        setProgressMap((m) => ({ ...m, [file.name]: pct }))
      ).then((res) => {
        setUploads((u) => [
          ...u,
          {
            public_id: res.public_id,
            secure_url: res.secure_url,
            duration: res.duration,
            bytes: res.bytes
          }
        ]);
      }).catch((err) => {
        console.error(err);
        alert("Upload error: " + (err?.message || "unknown"));
      });
    }
    setIsUploading(false);
  };

  const removeUpload = (public_id) => {
    setUploads((u) => u.filter((it) => it.public_id !== public_id));
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
        <a
          className="text-white/60 hover:text-white/90 underline"
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </header>

      <section className="glass p-4 md:p-6 shadow-soft space-y-4">
        <h2 className="text-lg font-semibold">1. Upload clips</h2>
        <p className="text-white/70 text-sm">
          Upload multiple short clips. We’ll transcribe and match-cut them by text and visuals.
        </p>

        <label className="btn btn-primary inline-block cursor-pointer">
          <input
            type="file"
            accept="video/*"
            multiple
            className="hidden"
            onChange={handleFilePick}
          />
          + Add videos
        </label>

        {isUploading && (
          <div className="space-y-2">
            {Object.entries(progressMap).map(([name, pct]) => (
              <div key={name} className="text-sm text-white/80">
                {name} — {pct}%
                <div className="w-full h-1 bg-white/10 rounded">
                  <div
                    className="h-1 bg-gradient-to-r from-brand-purple to-brand-pink rounded"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {uploads.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {uploads.map((u) => (
              <div key={u.public_id} className="relative group">
                <video
                  src={u.secure_url}
                  className="w-full rounded-lg border border-white/10"
                  controls
                />
                <button
                  className="absolute top-2 right-2 btn btn-muted text-xs"
                  onClick={() => removeUpload(u.public_id)}
                >
                  Remove
                </button>
                <div className="text-xs text-white/60 mt-1">
                  {(u.duration || 0).toFixed ? (u.duration || 0).toFixed(1) : u.duration}s
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass p-4 md:p-6 shadow-soft space-y-4">
        <h2 className="text-lg font-semibold">2. Settings</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-white/70 mb-1">Aspect ratio</div>
            <div className="flex gap-2">
              <button
                className={`btn ${aspect === "9:16" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setAspect("9:16")}
              >
                9:16
              </button>
              <button
                className={`btn ${aspect === "16:9" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setAspect("16:9")}
              >
                16:9
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Quality</div>
            <div className="flex gap-2">
              <button
                className={`btn ${quality === "1080p" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setQuality("1080p")}
              >
                1080p
              </button>
              <button
                className={`btn ${quality === "720p" ? "btn-accent" : "btn-muted"}`}
                onClick={() => setQuality("720p")}
              >
                720p
              </button>
            </div>
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Visual similarity</div>
            <div className="flex gap-2">
              <button
                className={`btn ${visualMatch ? "btn-accent" : "btn-muted"}`}
                onClick={() => setVisualMatch(true)}
              >
                On
              </button>
              <button
                className={`btn ${!visualMatch ? "btn-accent" : "btn-muted"}`}
                onClick={() => setVisualMatch(false)}
              >
                Off
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm text-white/70 mb-1">Phrase to match (text)</div>
          <input
            className="input"
            placeholder='e.g., "camera" or "let me explain"'
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
        </div>
      </section>

      <section className="glass p-4 md:p-6 shadow-soft space-y-3">
        <h2 className="text-lg font-semibold">3. Process</h2>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-accent disabled:opacity-50"
            disabled={!readyToTranscribe}
            onClick={() =>
              alert("Next step adds Deepgram transcription. Click Next after Step 3.")
            }
          >
            Transcribe
          </button>
          <button
            className="btn btn-muted"
            onClick={() =>
              alert("Match engine is coming in Step 4–5 (text + basic visual).")
            }
          >
            Compute matches
          </button>
          <button
            className="btn btn-primary"
            onClick={() => alert("Rendering via Shotstack arrives in Step 6.")}
          >
            Render
          </button>
        </div>
        {!CLOUD_NAME && (
          <div className="text-sm text-red-300">
            Cloudinary env not set yet. We’ll do that in Step 3 (Vercel).
          </div>
        )}
      </section>

      <footer className="text-center text-white/50 text-xs pt-2">
        Made on phone · Deploys on Vercel · Uploads via Cloudinary
      </footer>
    </main>
  );
}

function uploadToCloudinary(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;
    xhr.open("POST", url);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(json);
          else reject(json);
        } catch (err) {
          reject(err);
        }
      }
    };

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", UPLOAD_PRESET);
    data.append("folder", "matchcut");
    xhr.send(data);
  });
}
