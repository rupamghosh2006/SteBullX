import { NextResponse } from "next/server";
import { BlendAdapter } from "@/protocols/blend/adapter";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "blend") return NextResponse.json({ error: "Protocol not found" }, { status: 404 });
  const snapshot = await new BlendAdapter().getSnapshot();
  return NextResponse.json({ markets: snapshot.markets, data: snapshot.provenance });
}
