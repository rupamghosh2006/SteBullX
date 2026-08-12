import { NextResponse } from "next/server";
import { dataSourceLabel, dataSourceMode } from "@/services/data-source";

export async function GET() {
  const mode = dataSourceMode();
  return NextResponse.json({
    protocols: [{
      id: "blend",
      name: "Blend",
      status: mode === "live" ? "LIVE" : "DEMO",
      supportedMarket: "XLM_USDC",
      note: mode === "live"
        ? "Live mode reads a configured Blend index (BLEND_API_URL) with optional SDEX order-book and pool liquidity."
        : "MVP uses a reproducible demo adapter; configure DATA_SOURCE=live and BLEND_API_URL for live position analysis.",
    }],
  });
}