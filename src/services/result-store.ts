import type { DataProvenance } from "@/core/types";
import { Pool } from "pg";
import { getRedis } from "@/services/redis";

export interface StoredResult {
  id: string;
  protocol: string;
  market: string;
  data?: Partial<DataProvenance>;
}

const results = new Map<string, StoredResult>();
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;
const REDIS_TTL_SECONDS = 7 * 24 * 60 * 60;

async function redisSet(id: string, value: StoredResult) {
  const redis = getRedis();
  if (redis) await redis.set(`stebullx:result:${id}`, JSON.stringify(value), "EX", REDIS_TTL_SECONDS);
}

async function redisGet(id: string): Promise<StoredResult | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  const raw = await redis.get(`stebullx:result:${id}`);
  return raw ? JSON.parse(raw) as StoredResult : undefined;
}

/**
 * Tiered persistence: in-memory (always), Redis when REDIS_URL is configured,
 * PostgreSQL when DATABASE_URL is configured. Local dev stays usable without
 * either external service.
 */
export async function saveResult(result: StoredResult) {
  results.set(result.id, result);
  if (pool) await pool.query("INSERT INTO stress_tests (id, protocol, market, data_kind, data_source, result) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET result = EXCLUDED.result", [result.id, result.protocol, result.market, result.data?.kind ?? null, result.data?.source ?? null, result]);
  await redisSet(result.id, result);
  return result;
}

export async function getResult(id: string) {
  const inMemory = results.get(id);
  if (inMemory || !pool) {
    if (inMemory) return inMemory;
    return redisGet(id);
  }
  const response = await pool.query<{ result: StoredResult }>("SELECT result FROM stress_tests WHERE id = $1", [id]);
  return response.rows[0]?.result ?? redisGet(id);
}
