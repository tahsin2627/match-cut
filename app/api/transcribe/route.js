import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { clips = [], language = "en" } = await req.json();
    if (!Array.isArray(clips) || clips.length === 0) {
      return NextResponse.json({ error: "clips required" }, { status: 400 });
    }
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "DEEPGRAM_API_KEY missing" }, { status: 500 });
    }

    // Keep it light for first pass (transcribe first 20 videos max)
    const subset = clips.slice(0, 20);

    const results = [];
    for (const clip of subset) {
      const url = clip.secure_url || clip.url;
      if (!url) continue;

      const res = await fetch(
        `https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=${encodeURIComponent(language)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Token ${key}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ url })
        }
      );

      const json = await res.json();
      if (!res.ok) {
        results.push({ ...clip, error: json });
        continue;
      }

      const alt = json?.results?.channels?.[0]?.alternatives?.[0];
      const words = (alt?.words || []).map((w) => ({
        w: String(w.word || "").toLowerCase(),
        start: Number(w.start || 0),
        end: Number(w.end || 0),
        confidence: Number(w.confidence || 0)
      }));

      results.push({
        public_id: clip.public_id,
        url,
        transcript: alt?.transcript || "",
        words,
        duration:
          json?.metadata?.duration ||
          (words.length ? Number(words[words.length - 1].end) : 0)
      });
    }

    return NextResponse.json({ transcripts: results });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e?.message || "unexpected" }, { status: 500 });
  }
}
