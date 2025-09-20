import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_BASE = "https://api.shotstack.io/stage";

export async function GET(req) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const key = process.env.SHOTSTACK_API_KEY;
    if (!key) return NextResponse.json({ error: "SHOTSTACK_API_KEY missing" }, { status: 500 });

    const res = await fetch(`${API_BASE}/render/${id}`, {
      headers: { "x-api-key": key }
    });
    const json = await res.json();
    if (!res.ok) return NextResponse.json(json, { status: res.status });

    // Shotstack returns response.status and response.url when done
    const status = json.response?.status || json.status;
    const url = json.response?.url || json.url || null;

    return NextResponse.json({ status, url, raw: json });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
