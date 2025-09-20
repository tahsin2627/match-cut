import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://api.shotstack.io/stage";

export async function POST(req) {
  try {
    const { segments = [], aspect = "9:16", quality = "1080p", fps = 30 } = await req.json();
    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json({ error: "segments required" }, { status: 400 });
    }
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    let t = 0;
    const clips = segments.map((s) => {
      const length = Math.max(0.1, Number(s.eo) - Number(s.so));
      const clip = {
        asset: { type: "video", src: s.url },
        start: Number(t.toFixed(3)),
        length: Number(length.toFixed(3)),
        trim: Number(Number(s.so).toFixed(3)),
        fit: "cover",
        position: "center"
      };
      t += length;
      return clip;
    });

    const resolution = quality === "1080p" ? "1080p" : "hd"; // hd = 720p
    const timeline = {
      background: "#000000",
      tracks: [{ clips }]
    };

    const payload = {
      timeline,
      output: {
        format: "mp4",
        resolution,
        aspectRatio: aspect,
        fps
      }
    };

    const res = await fetch(`${API_BASE}/render`, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    if (!res.ok) return NextResponse.json(json, { status: res.status });

    return NextResponse.json({ id: json.response?.id || json.id, response: json.response || json });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
