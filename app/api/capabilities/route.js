import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const caps = {
    pexels: !!process.env.PEXELS_API_KEY,
    ai_cf: !!process.env.CF_ACCOUNT_ID && !!process.env.CF_API_TOKEN,
    ai_hf: !!process.env.HF_TOKEN
  };
  return NextResponse.json(caps);
}
