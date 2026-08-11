import { NextResponse } from "next/server";
import { BlendAdapter } from "@/protocols/blend/adapter";

export async function GET() {
  const snapshot = await new BlendAdapter().getSnapshot();
  return NextResponse.json({ liquidity: snapshot.liquidity, data: snapshot.provenance });
}
