import { NextResponse } from "next/server";
import { getEpisode } from "@/data/historical-archive";
import { requireApiKey } from "@/services/api-guard";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireApiKey(request);
  if (denied) return denied;
  const { id } = await params;
  const episode = await getEpisode(id);
  if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  return NextResponse.json({ episode });
}
