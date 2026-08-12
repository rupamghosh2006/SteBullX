import { NextResponse } from "next/server";
import { defaultScenario, runStressTest } from "@/engine/simulation";
import type { StressScenario } from "@/core/types";
import { resolveBlendSnapshot } from "@/services/data-source";
import { saveResult } from "@/services/result-store";
import { requireApiKey } from "@/services/api-guard";

export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({})) as { protocol?: string; scenario?: Partial<StressScenario> };
    if ((body.protocol ?? "blend") !== "blend") return NextResponse.json({ error: "Only the Blend MVP adapter is available." }, { status: 400 });
    const scenario: StressScenario = { ...defaultScenario, ...body.scenario, assetPriceShocks: body.scenario?.assetPriceShocks ?? defaultScenario.assetPriceShocks, liquidityShocks: body.scenario?.liquidityShocks ?? defaultScenario.liquidityShocks };
    let snapshot;
    try {
      snapshot = await resolveBlendSnapshot();
    } catch (cause) {
      return NextResponse.json({ error: cause instanceof Error ? cause.message : "Data source unavailable." }, { status: 503 });
    }
    const result = await saveResult(runStressTest(snapshot, scenario));
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run the stress test." }, { status: 400 });
  }
}
