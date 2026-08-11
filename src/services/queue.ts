import { randomUUID } from "node:crypto";
import { getRedis } from "@/services/redis";

export type JobType = "STRESS_TEST" | "REPLAY";
export type JobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface Job {
  jobId: string;
  type: JobType;
  payload: Record<string, unknown>;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  resultId?: string;
  error?: string;
}

const QUEUE_KEY = "stebullx:queue:jobs";
const JOB_TTL_SECONDS = 24 * 60 * 60;
const inMemoryJobs = new Map<string, Job>();
const inMemoryQueue: Job[] = [];

async function persist(job: Job) {
  const redis = getRedis();
  if (redis) await redis.set(`stebullx:job:${job.jobId}`, JSON.stringify(job), "EX", JOB_TTL_SECONDS);
  else inMemoryJobs.set(job.jobId, job);
}

export async function enqueueJob(type: JobType, payload: Record<string, unknown>): Promise<Job> {
  const job: Job = { jobId: `JOB-${randomUUID().slice(0, 12).toUpperCase()}`, type, payload, status: "QUEUED", createdAt: new Date().toISOString() };
  const redis = getRedis();
  if (redis) await redis.lpush(QUEUE_KEY, job.jobId);
  else inMemoryQueue.push(job);
  await persist(job);
  return job;
}

export async function getJob(jobId: string): Promise<Job | undefined> {
  const redis = getRedis();
  if (redis) {
    const raw = await redis.get(`stebullx:job:${jobId}`);
    return raw ? JSON.parse(raw) as Job : undefined;
  }
  return inMemoryJobs.get(jobId);
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<Job> {
  const current = await getJob(jobId);
  if (!current) throw new Error(`Unknown job ${jobId}.`);
  const next = { ...current, ...patch };
  await persist(next);
  return next;
}

/** Blocks for the next job; returns undefined on timeout so the loop can keep ticking. */
export async function takeJob(timeoutSeconds = 3): Promise<Job | undefined> {
  const redis = getRedis();
  if (redis) {
    const [_, jobId] = await redis.brpop(QUEUE_KEY, timeoutSeconds) as [string, string] | [];
    if (!jobId) return undefined;
    const job = await getJob(jobId);
    if (job) await updateJob(jobId, { status: "RUNNING", startedAt: new Date().toISOString() });
    return job;
  }
  const job = inMemoryQueue.shift();
  if (job) {
    await updateJob(job.jobId, { status: "RUNNING", startedAt: new Date().toISOString() });
    return job;
  }
  await new Promise((resolve) => setTimeout(resolve, timeoutSeconds * 1000));
  return undefined;
}
