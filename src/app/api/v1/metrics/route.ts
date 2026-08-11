import { NextResponse } from "next/server";
import { getMetrics } from "@/services/observability";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  return NextResponse.json(await getMetrics());
}
