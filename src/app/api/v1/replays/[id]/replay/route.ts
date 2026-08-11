import { NextResponse } from "next/server";
import { getEpisode } from "@/data/historical-archive";
import { replayEpisode } from "@/engine/replay";
import { saveResult } from "@/services/result-store";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = getEpisode(id);
  if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });
  try {
    const replay = replayEpisode(episode);
    await saveResult(replay);
    return NextResponse.json(replay, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to replay the episode.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
