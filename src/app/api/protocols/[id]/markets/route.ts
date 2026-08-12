import { NextResponse } from "next/server";
import { resolveBlendSnapshot } from "@/services/data-source";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "blend") return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
  try {
    const snapshot = await resolveBlendSnapshot();
    return NextResponse.json({ markets: snapshot.markets, data: snapshot.provenance });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Data source unavailable." }, { status: 503 });
  }
}