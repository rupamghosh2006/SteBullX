import { NextResponse } from "next/server";
import { resolveBlendSnapshot } from "@/services/data-source";

export async function GET() {
  try {
    const snapshot = await resolveBlendSnapshot();
    return NextResponse.json({ markets: snapshot.markets, data: snapshot.provenance });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Data source unavailable." }, { status: 503 });
  }
}