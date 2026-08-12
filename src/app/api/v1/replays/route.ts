import { NextResponse } from "next/server";
import { listEpisodes } from "@/data/historical-archive";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const episodes = (await listEpisodes()).map(({ id, protocol, marketId, title, startLedger, endLedger, startedAt, note, observed }) => ({ id, protocol, marketId, title, startLedger, endLedger, startedAt, note, observed }));
  return NextResponse.json({ episodes });
}
