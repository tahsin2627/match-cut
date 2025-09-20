import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOTSTACK = "https://api.shotstack.io/stage";

function escapeHtml(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function dimsFor(aspect, quality){if(aspect==="9:16")return quality==="1080p"?{w:1080,h:1920}:{w:720,h:1280};return quality==="1080p"?{w:1920,h:1080}:{w:1280,h:720};}
function mapResolution(q){return q==="1080p"?"1080":"hd";} // 720p -> "hd"

// Cloudflare Images uploader (hosts AI data URLs so Shotstack payload stays small)
async function uploadDataUrlToCFImages(dataUrl) {
  const accountId = process.env.CF_IMAGES_ACCOUNT_ID;
  const token = process.env.CF_IMAGES_API_TOKEN;
  if (!accountId || !token) throw new Error("Missing CF_IMAGES_* env vars");

  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1];
  const b64 = m[2];
  const buffer = Buffer.from(b64, "base64");

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mime }), `gen-${Date.now()}.png`);

  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const j = await r.json();
  if (!r.ok || !j.success) throw new Error(j?.errors?.[0]?.message || "CF Images upload failed");
  const url = j.result?.variants?.[0];
  if (!url) throw new Error("CF Images variant URL missing");
  return url;
}
async function ensureHosted(url, aspect, phrase){
  if (url.startsWith("data:image")) {
    try { return await uploadDataUrlToCFImages(url); }
    catch {
      const dims = dimsFor(aspect,"1080p");
      return `https://picsum.photos/seed/${encodeURIComponent((phrase||"matchcut")+"-"+Math.random().toString(36).slice(2))}/${dims.w}/${dims.h}`;
    }
  }
  return url;
}

// Sources (Pexels / AI via Cloudflare or Hugging Face / Placeholder)
async function getImages({ phrase, aspect, count = 1, source = "pexels" }) {
  const urls = [];
  const orientation = aspect === "9:16" ? "portrait" : "landscape";
  const usePexels = source === "pexels" && !!process.env.PEXELS_API_KEY;
  const useCF = source === "ai" && !!process.env.CF_ACCOUNT_ID && !!process.env.CF_API_TOKEN;
  const useHF = source === "ai" && !!process.env.HF_TOKEN;

  if (usePexels) {
    try {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(phrase||"abstract")}&per_page=${Math.max(10,count)}&orientation=${orientation}`, { headers: { Authorization: process.env.PEXELS_API_KEY } });
      const j = await r.json();
      const photos = Array.isArray(j.photos) ? j.photos : [];
      while (urls.length < count && photos.length) {
        const pick = photos.splice(Math.floor(Math.random()*photos.length),1)[0];
        const src = pick?.src?.original || pick?.src?.large2x || pick?.src?.large;
        if (src) urls.push(src);
      }
    } catch {}
  }
  if (useCF && urls.length < count) {
    const remain = count - urls.length;
    const ai = await generateAIImagesCF({ prompt: phrase, n: remain }).catch(() => []);
    urls.push(...ai);
  }
  if (!useCF && useHF && urls.length < count) {
    const remain = count - urls.length;
    const ai = await generateAIImagesHF({ prompt: phrase, n: remain }).catch(() => []);
    urls.push(...ai);
  }
  while (urls.length < count) {
    const dims = dimsFor(aspect,"1080p");
    urls.push(`https://picsum.photos/seed/${encodeURIComponent((phrase||"matchcut")+"-"+Math.random().toString(36).slice(2))}/${dims.w}/${dims.h}`);
  }

  const hosted = [];
  for (const u of urls.slice(0, count)) {
    hosted.push(await ensureHosted(u, aspect, phrase));
  }
  return hosted;
}

async function generateAIImagesCF({ prompt, n = 1 }) {
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const model = "@cf/black-forest-labs/flux-1-schnell";
  const out = [];
  for (let i=0;i<n;i++){
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ prompt })
    });
    if (!res.ok) throw new Error(`CF AI error ${res.status}`);
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    out.push(`data:image/png;base64,${b64}`);
  }
  return out;
}
async function generateAIImagesHF({ prompt, n = 1 }) {
  const token = process.env.HF_TOKEN;
  const model = "black-forest-labs/FLUX.1-schnell";
  const out = [];
  for (let i=0;i<n;i++){
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/png" },
      body: JSON.stringify({ inputs: prompt })
    });
    if (!res.ok) throw new Error(`HF error ${res.status}`);
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    out.push(`data:image/png;base64,${b64}`);
  }
  return out;
}

export async function POST(req) {
  try {
    const { phrase="you", aspect="9:16", quality="1080p", source="pexels", overlay=true, karaoke=true } = await req.json();
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    // 1) Get and host image
    const [imageUrl] = await getImages({ phrase, aspect, count: 1, source });

    // 2) Build timeline: background as IMAGE clip + overlay as HTML clip
    const safeWord = escapeHtml(phrase);
    const length = 4.0;
    const dims = dimsFor(aspect, "1080p");
    const resolution = mapResolution(quality);

    const imageClip = {
      asset: { type: "image", src: imageUrl },
      start: 0,
      length,
      fit: "cover",
      position: "center",
      transition: { in: "fade", out: "fade" }
    };

    const html = overlay ? `
      <div class="wrap">
        <div class="chip"><span class="label">${safeWord}</span>${karaoke ? `<span class="fill"></span>` : ``}</div>
      </div>` : `<div class="wrap"></div>`;
    const css = `
      .wrap{width:100%;height:100%;position:relative;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;}
      .chip{margin-bottom:8%;padding:14px 26px;border-radius:14px;font:800 72px Montserrat,Arial,sans-serif;color:#fff;background:linear-gradient(135deg,#7C3AED,#FF5CAA);box-shadow:0 12px 34px rgba(0,0,0,.4);position:relative;overflow:hidden;}
      .chip .label{position:relative;z-index:2;}
      .chip .fill{position:absolute;left:0;top:0;bottom:0;width:0%;background:rgba(255,255,255,.22);animation:fill 3.2s linear forwards .4s;z-index:1;}
      @keyframes fill{from{width:0%;}to{width:100%;}}
      @media (max-aspect-ratio:10/16){.chip{font-size:60px;}}
    `;
    const overlayClip = {
      asset: { type: "html", html, css, width: dims.w, height: dims.h },
      start: 0,
      length,
      position: "center",
      transition: { in: "fade", out: "fade" }
    };

    const payload = {
      timeline: { background: "#000000", tracks: [{ clips: [imageClip] }, { clips: [overlayClip] }] },
      output: { format: "mp4", resolution, aspectRatio: aspect, fps: 30 }
    };

    // 3) Render
    const res = await fetch(`${SHOTSTACK}/render`, { method: "POST", headers: { "x-api-key": key, "content-type": "application/json" }, body: JSON.stringify(payload) });
    const txt = await res.text();
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    if (!res.ok) return NextResponse.json({ error: "shotstack_error", detail: json }, { status: res.status });

    return NextResponse.json({ id: json.response?.id || json.id });
  } catch (e) {
    return NextResponse.json({ error: e.message || "unexpected" }, { status: 500 });
  }
}
