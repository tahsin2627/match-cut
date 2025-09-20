import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    const expression =
      process.env.CLOUDINARY_LIBRARY_EXPRESSION ||
      "resource_type:video AND tags=matchlib";
    if (!cloud || !key || !secret) {
      return NextResponse.json(
        { error: "Missing Cloudinary credentials" },
        { status: 500 }
      );
    }

    const cursor = new URL(req.url).searchParams.get("cursor") || undefined;
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud}/resources/search`,
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${key}:${secret}`).toString("base64"),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expression,
          with_field: ["tags", "context"],
          max_results: 100,
          next_cursor: cursor
        })
      }
    );

    const json = await res.json();
    if (!res.ok) return NextResponse.json(json, { status: res.status });

    const items = (json.resources || []).map((r) => ({
      public_id: r.public_id,
      secure_url: r.secure_url, // direct URL to the mp4
      duration: r.duration || 0,
      bytes: r.bytes || 0,
      width: r.width,
      height: r.height,
      tags: r.tags || []
    }));

    return NextResponse.json({ items, next_cursor: json.next_cursor || null });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
