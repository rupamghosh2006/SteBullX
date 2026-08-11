import { NextResponse } from "next/server";
import { defaultScenario } from "@/engine/simulation";

export async function GET() {
  return NextResponse.json({
    scenarios: [
      { ...defaultScenario, id: "xlm-20-liquidity-40" },
      { ...defaultScenario, id: "xlm-10-liquidity-20", name: "XLM −10% / liquidity −20%", assetPriceShocks: { XLM: -0.1 }, liquidityShocks: { XLM_USDC: -0.2 } },
      { ...defaultScenario, id: "xlm-30-liquidity-50", name: "XLM −30% / liquidity −50%", assetPriceShocks: { XLM: -0.3 }, liquidityShocks: { XLM_USDC: -0.5 } },
    ],
  });
}
