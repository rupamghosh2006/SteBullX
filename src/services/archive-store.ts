import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import type { HistoricalEpisode } from "@/core/types";
import { getRedis } from "@/services/redis";

const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

const FALLBACK_FILE = process.env.STEBULLX_ARCHIVE_FILE ?? path.join(process.cwd(), "data", "archive-store.json");
const REDIS_TTL_SECONDS = 90 * 24 * 60 * 60;

function readFallback(): HistoricalEpisode[] {
  if (!existsSync(FALLBACK_FILE)) return [];
  try {
    const raw = readFileSync(FALLBACK_FILE, "utf8");
    return JSON.parse(raw).episodes as HistoricalEpisode[];
  } catch {
    return [];
  }
}

function writeFallback(episodes: HistoricalEpisode[]) {
  mkdirSync(path.dirname(FALLBACK_FILE), { recursive: true });
  writeFileSync(FALLBACK_FILE, JSON.stringify({ episodes }, null, 2), "utf8");
}

async function redisList(): Promise<HistoricalEpisode[]> {
  const redis = getRedis();
  if (!redis) return [];
  const raw = await redis.get("stebullx:archives");
  return raw ? JSON.parse(raw).episodes as HistoricalEpisode[] : [];
}

/**
 * Archived snapshots captured by `npm run archive`. Tiered persistence mirrors
 * result-store: PostgreSQL when DATABASE_URL is set, Redis when REDIS_URL is
 * set, otherwise a local JSON file. Episodes outside the fixture archive are
 * labelled HISTORICAL by the archiver, never DEMO.
 */
export async function listArchivedEpisodes(): Promise<HistoricalEpisode[]> {
  if (pool) {
    const response = await pool.query<{ episode: HistoricalEpisode }>("SELECT episode FROM replay_archives ORDER BY created_at");
    return response.rows.map((row) => row.episode);
  }
  const local = readFallback();
  if (local.length > 0) return local;
  return redisList();
}

export async function appendArchivedEpisode(episode: HistoricalEpisode): Promise<void> {
  if (pool) {
    await pool.query(
      "INSERT INTO replay_archives (id, episode, created_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET episode = EXCLUDED.episode",
      [episode.id, episode],
    );
    return;
  }
  const episodes = [...readFallback().filter((item) => item.id !== episode.id), episode];
  if (process.env.REDIS_URL) {
    const redis = getRedis();
    if (redis) await redis.set("stebullx:archives", JSON.stringify({ episodes }), "EX", REDIS_TTL_SECONDS);
  } else {
    writeFallback(episodes);
  }
}

export async function getArchivedEpisode(id: string): Promise<HistoricalEpisode | undefined> {
  const episodes = await listArchivedEpisodes();
  return episodes.find((episode) => episode.id === id);
}