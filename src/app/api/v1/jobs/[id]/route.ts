import { NextResponse } from "next/server";
import { getJob } from "@/services/queue";
import { getResult } from "@/services/result-store";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });
  const result = job.resultId ? await getResult(job.resultId) : undefined;
  return NextResponse.json({ job, result });
}
