import { getRedis } from "@/services/redis";

export type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const info = (event: string, fields?: Record<string, unknown>) => log("info", event, fields);
export const warn = (event: string, fields?: Record<string, unknown>) => log("warn", event, fields);
export const error = (event: string, fields?: Record<string, unknown>) => log("error", event, fields);

const counters = new Map<string, number>();
const durations = new Map<string, { count: number; totalMs: number }>();

export interface MetricsSnapshot {
  counters: Record<string, number>;
  durations: Record<string, { count: number; avgMs: number }>;
  startedAt: string;
}

export async function recordMetric(name: string, delta = 1): Promise<void> {
  counters.set(name, (counters.get(name) ?? 0) + delta);
  const redis = getRedis();
  if (redis) await redis.incr(`stebullx:metric:${name}:count`).catch(() => 0);
}

export async function recordDuration(name: string, ms: number): Promise<void> {
  const current = durations.get(name) ?? { count: 0, totalMs: 0 };
  durations.set(name, { count: current.count + 1, totalMs: current.totalMs + ms });
  const redis = getRedis();
  if (redis) {
    await redis.incr(`stebullx:metric:${name}:count`).catch(() => 0);
    await redis.incrbyfloat(`stebullx:metric:${name}:totalms`, ms).catch(() => 0);
  }
}

async function redisMetrics(): Promise<MetricsSnapshot | undefined> {
  const redis = getRedis();
  if (!redis) return undefined;
  const keys = await redis.keys("stebullx:metric:*");
  const counters: Record<string, number> = {};
  const durations: Record<string, { count: number; avgMs: number }> = {};
  for (const key of keys) {
    const name = key.replace("stebullx:metric:", "");
    if (name.endsWith(":count")) {
      const metric = name.slice(0, -6);
      counters[metric] = Number(await redis.get(key)) || 0;
    } else if (name.endsWith(":totalms")) {
      const metric = name.slice(0, -8);
      durations[metric] = { count: 0, avgMs: 0 };
    }
  }
  for (const [metric, entry] of Object.entries(durations)) {
    const total = Number(await redis.get(`stebullx:metric:${metric}:totalms`)) || 0;
    const count = counters[metric] ?? 0;
    durations[metric] = { count, avgMs: count > 0 ? total / count : 0 };
  }
  return { counters, durations, startedAt: new Date().toISOString() };
}

export async function getMetrics(): Promise<MetricsSnapshot> {
  const redisSnapshot = await redisMetrics();
  if (redisSnapshot) return redisSnapshot;
  const snapshot: MetricsSnapshot = { counters: Object.fromEntries(counters), durations: {}, startedAt: new Date().toISOString() };
  for (const [name, { count, totalMs }] of durations) {
    snapshot.durations[name] = { count, avgMs: count > 0 ? totalMs / count : 0 };
  }
  return snapshot;
}

export function timingMs(startedAt: number): number {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
