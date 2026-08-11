import { NextResponse } from "next/server";
import { defaultScenario } from "@/engine/simulation";
import type { StressScenario } from "@/core/types";
import { enqueueJob } from "@/services/queue";
import { processJob } from "@/services/jobs";
import { getRedis } from "@/services/redis";
import { requireApiKey } from "@/services/api-guard";

export async function POST(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  try {
    const body = await request.json().catch(() => ({})) as { protocol?: string; scenario?: Partial<StressScenario> };
    if ((body.protocol ?? "blend") !== "blend") return NextResponse.json({ error: "Only the Blend MVP adapter is available." }, { status: 400 });
    const scenario: StressScenario = { ...defaultScenario, ...body.scenario, assetPriceShocks: body.scenario?.assetPriceShocks ?? defaultScenario.assetPriceShocks, liquidityShocks: body.scenario?.liquidityShocks ?? defaultScenario.liquidityShocks };
    const job = await enqueueJob("STRESS_TEST", { protocol: body.protocol ?? "blend", scenario });
    // Without a dedicated worker (no REDIS_URL), process the job in-process so
    // dev and single-node deployments still complete asynchronously.
    if (!getRedis()) setImmediate(() => void processJob(job));
    return NextResponse.json({ jobId: job.jobId, status: job.status }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to enqueue the stress test.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
