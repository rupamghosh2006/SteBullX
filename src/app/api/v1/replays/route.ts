import { NextResponse } from "next/server";
import { replayArchive } from "@/data/historical-archive";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const episodes = replayArchive.map(({ id, protocol, marketId, title, startLedger, endLedger, startedAt, note }) => ({ id, protocol, marketId, title, startLedger, endLedger, startedAt, note }));
  return NextResponse.json({ episodes });
}
