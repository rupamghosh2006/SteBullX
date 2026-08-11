import { NextResponse } from "next/server";
import { getResult } from "@/services/result-store";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;
  const result = await getResult(id);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "Stress test not found." }, { status: 404 });
}
