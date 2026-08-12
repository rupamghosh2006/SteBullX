import { runStressTest, defaultScenario } from "@/engine/simulation";
import { replayEpisode } from "@/engine/replay";
import { getEpisode } from "@/data/historical-archive";
import { resolveBlendSnapshot } from "@/services/data-source";
import { saveResult } from "@/services/result-store";
import { takeJob, updateJob, type Job } from "@/services/queue";
import { error as logError, info, recordMetric } from "@/services/observability";
import type { StressScenario } from "@/core/types";

export async function processJob(job: Job): Promise<void> {
  const startedAt = performance.now();
  try {
    if (job.type === "STRESS_TEST") {
      const protocol = (job.payload.protocol as string | undefined) ?? "blend";
      if (protocol !== "blend") throw new Error("Only the Blend MVP adapter is available.");
      const scenario: StressScenario = { ...defaultScenario, ...(job.payload.scenario as Partial<StressScenario> | undefined) };
      const result = runStressTest(await resolveBlendSnapshot(), scenario);
      await saveResult(result);
      await updateJob(job.jobId, { status: "SUCCEEDED", resultId: result.id, finishedAt: new Date().toISOString() });
      await recordMetric("jobs.processed");
      info("job.succeeded", { jobId: job.jobId, type: job.type, resultId: result.id, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
      return;
    }
    if (job.type === "REPLAY") {
      const episodeId = job.payload.episodeId as string;
      const episode = await getEpisode(episodeId);
      if (!episode) throw new Error(`Unknown episode ${episodeId}.`);
      const replay = replayEpisode(episode);
      await saveResult(replay);
      await updateJob(job.jobId, { status: "SUCCEEDED", resultId: replay.id, finishedAt: new Date().toISOString() });
      await recordMetric("jobs.processed");
      info("job.succeeded", { jobId: job.jobId, type: job.type, resultId: replay.id, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
      return;
    }
    throw new Error(`Unsupported job type ${job.type}.`);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Job failed.";
    await updateJob(job.jobId, { status: "FAILED", error: message, finishedAt: new Date().toISOString() });
    await recordMetric("jobs.failed");
    logError("job.failed", { jobId: job.jobId, type: job.type, error: message, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 });
  }
}

/**
 * Long-running worker loop for self-hosted/Docker deployments with Redis.
 * Serverless platforms (Vercel) cannot host this loop; when REDIS_URL is
 * unset, jobs are processed in-process by the enqueueing API route instead.
 */
export async function startWorker(): Promise<void> {
  // eslint-disable-next-line no-constant-condition
  for (;;) {
    const job = await takeJob();
    if (job) await processJob(job);
  }
}
