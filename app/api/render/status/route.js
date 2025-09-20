import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SHOTSTACK = "https://api.shotstack.io/stage";

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    const r = await fetch(`${SHOTSTACK}/render/${id}`, { headers: { "x-api-key": key } });
    const j = await r.json();
    if (!r.ok) return NextResponse.json(j, { status: r.status });

    const status = j.response?.status || j.status;
    const url = j.response?.url || j.url || null;
    return NextResponse.json({ status, url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
