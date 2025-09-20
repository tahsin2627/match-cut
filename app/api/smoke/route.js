import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOTSTACK = "https://api.shotstack.io/stage";

function dimsFor(aspect, quality) {
  if (aspect === "9:16") return quality === "1080p" ? { w: 1080, h: 1920 } : { w: 720, h: 1280 };
  return quality === "1080p" ? { w: 1920, h: 1080 } : { w: 1280, h: 720 };
}

export async function POST(req) {
  try {
    const { aspect = "9:16", quality = "720p" } = await req.json();
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    const dims = dimsFor(aspect, quality);
    const html = `<div class="wrap"><div class="chip">Shotstack OK</div></div>`;
    const css = `
      .wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#0B0C10;}
      .chip{font:800 64px Montserrat,Arial;color:#fff;padding:16px 28px;border-radius:14px;background:linear-gradient(135deg,#7C3AED,#FF5CAA);box-shadow:0 12px 34px rgba(0,0,0,.4);}
    `;

    const payload = {
      timeline: {
        background: "#000000",
        tracks: [{ clips: [{ asset: { type: "html", html, css, width: dims.w, height: dims.h }, start: 0, length: 2, position: "center", transition: { in: "fade", out: "fade" } }] }]
      },
      output: { format: "mp4", resolution: quality === "1080p" ? "1080p" : "hd", aspectRatio: aspect, fps: 30 }
    };

    const res = await fetch(`${SHOTSTACK}/render`, { method: "POST", headers: { "x-api-key": key, "content-type": "application/json" }, body: JSON.stringify(payload) });
    const txt = await res.text();
    let json; try { json = JSON.parse(txt); } catch { json = { raw: txt }; }
    if (!res.ok) return NextResponse.json({ error: "shotstack_error", detail: json }, { status: res.status });

    return NextResponse.json({ id: json.response?.id || json.id });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
