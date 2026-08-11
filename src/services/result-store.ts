import type { StressTestResult } from "@/core/types";
import { Pool } from "pg";

const results = new Map<string, StressTestResult>();
const databaseUrl = process.env.DATABASE_URL;
const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

/** PostgreSQL persistence when DATABASE_URL is configured; local dev stays usable with an explicitly ephemeral fallback. */
export async function saveResult(result: StressTestResult) {
  results.set(result.id, result);
  if (pool) await pool.query("INSERT INTO stress_tests (id, protocol, market, data_kind, data_source, result) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET result = EXCLUDED.result", [result.id, result.protocol, result.market, result.data.kind, result.data.source, result]);
  return result;
}

export async function getResult(id: string) {
  const inMemory = results.get(id);
  if (inMemory || !pool) return inMemory;
  const response = await pool.query<{ result: StressTestResult }>("SELECT result FROM stress_tests WHERE id = $1", [id]);
  return response.rows[0]?.result;
}
