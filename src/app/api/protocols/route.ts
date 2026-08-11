import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    protocols: [{
      id: "blend",
      name: "Blend",
      status: "DEMO",
      supportedMarket: "XLM_USDC",
      note: "MVP uses a reproducible demo adapter; a verified indexer is required before live position analysis.",
    }],
  });
}
