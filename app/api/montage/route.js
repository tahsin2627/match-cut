import { NextResponse } from "next/server";
import { Buffer } from "node:buffer";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOTSTACK = "https://api.shotstack.io/stage";

function escapeHtml(s=""){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function dimsFor(aspect, quality){if(aspect==="9:16")return quality==="1080p"?{w:1080,h:1920}:{w:720,h:1280};return quality==="1080p"?{w:1920,h:1080}:{w:1280,h:720};}

async function getImages({ phrase, aspect, count = 4, source = "pexels" }) {
  const urls = [];
  const dims = dimsFor(aspect, "1080p");
  const orientation = aspect === "9:16" ? "portrait" : "landscape";

  const usePexels = source === "pexels" && !!process.env.PEXELS_API_KEY;
  const useCF = source === "ai" && !!process.env.CF_ACCOUNT_ID && !!process.env.CF_API_TOKEN;
  const useHF = source === "ai" && !!process.env.HF_TOKEN;

  if (usePexels) {
    try {
      const r = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(phrase || "abstract")}&per_page=${Math.max(10, count)}&orientation=${orientation}`,
        { headers: { Authorization: process.env.PEXELS_API_KEY } }
      );
      const j = await r.json();
      const photos = Array.isArray(j.photos) ? j.photos : [];
      while (urls.length < count && photos.length) {
        const pick = photos.splice(Math.floor(Math.random() * photos.length), 1)[0];
        const src = pick?.src?.original || pick?.src?.large2x || pick?.src?.large;
        if (src) urls.push(src);
      }
    } catch (e) { console.warn("PEXELS fallback:", e?.message); }
  }

  if (useCF && urls.length < count) {
    try {
      const remain = count - urls.length;
      const ai = await generateAIImagesCF({ prompt: phrase, n: remain });
      urls.push(...ai);
    } catch (e) { console.warn("CF AI fallback:", e?.message); }
  }

  if (!useCF && useHF && urls.length < count) {
    try {
      const remain = count - urls.length;
      const ai = await generateAIImagesHF({ prompt: phrase, n: remain });
      urls.push(...ai);
    } catch (e) { console.warn("HF AI fallback:", e?.message); }
  }

  while (urls.length < count) {
    urls.push(`https://picsum.photos/seed/${encodeURIComponent((phrase || "matchcut") + "-" + Math.random().toString(36).slice(2))}/${dims.w}/${dims.h}`);
  }
  return urls.slice(0, count);
}

async function generateAIImagesCF({ prompt, n = 1 }) {
  const account = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  const model = "@cf/black-forest-labs/flux-1-schnell";
  const out = [];
  for (let i = 0; i < n; i++) {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
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
  for (let i = 0; i < n; i++) {
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
    const { phrase = "you", aspect = "9:16", quality = "1080p", source = "pexels", overlay = true, zoom = true, karaoke = true, count = 4 } = await req.json();
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    const images = await getImages({ phrase, aspect, count, source });
    const safeWord = escapeHtml(phrase);
    const resolution = quality === "1080p" ? "1080p" : "hd";
    const dims = dimsFor(aspect, "1080p");

    const clips = images.map((img, i) => {
      const html = `
        <div class="wrap">
          <div class="bg"></div>
          ${overlay ? `<div class="chip"><span class="label">${safeWord}</span>${karaoke ? `<span class="fill"></span>` : ``}</div>` : ``}
        </div>
      `;
      const css = `
        .wrap { width:100%; height:100%; position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .bg { position:absolute; inset:0; background-image:url("${img}"); background-size:cover; background-position:center; transform:scale(1.05); ${zoom ? `animation:zoom 1s ease-out forwards;` : ``} }
        @keyframes zoom { from { transform:scale(1.05); } to { transform:scale(1.10); } }
        .chip { position:absolute; bottom:8%; padding:12px 22px; border-radius:14px; font-family:Montserrat,Arial,sans-serif; font-weight:800; font-size:64px; color:#fff; background:linear-gradient(135deg,#7C3AED,#FF5CAA); box-shadow:0 12px 34px rgba(0,0,0,0.4); overflow:hidden; }
        .chip .label { position:relative; z-index:2; }
        .chip .fill { position:absolute; left:0; top:0; bottom:0; width:0%; background:rgba(255,255,255,0.22); animation:fill 0.8s linear forwards 0.15s; z-index:1; }
        @keyframes fill { from { width:0%; } to { width:100%; } }
        @media (max-aspect-ratio:10/16) { .chip { font-size:52px; } }
      `;
      return { asset: { type: "html", html, css, width: dims.w, height: dims.h }, start: i * 1.0, length: 1.0, position: "center", transition: { in: "fade", out: "fade" } };
    });

    const timeline = { background: "#000000", tracks: [{ clips }] };
    const payload = { timeline, output: { format: "mp4", resolution, aspectRatio: aspect, fps: 30 } };

    const res = await fetch(`${SHOTSTACK}/render`, { method: "POST", headers: { "x-api-key": key, "content-type": "application/json" }, body: JSON.stringify(payload) });
    const json = await res.json();
    if (!res.ok) return NextResponse.json(json, { status: res.status });

    return NextResponse.json({ id: json.response?.id || json.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message || "unexpected" }, { status: 500 });
  }
}
