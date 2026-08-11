import { round } from "@/core/math";
import { sha256 } from "@/core/hash";
import { runStressTest, MODEL_VERSION } from "@/engine/simulation";
import type { HistoricalEpisode, HistoricalReplayResult, StressScenario } from "@/core/types";

/**
 * Historical replay: reconstruct protocol state at a pinned ledger, replay the
 * observed market movement through the simulation engine, and compare the
 * prediction against the archived outcome. Errors feed model calibration.
 */
export function replayEpisode(episode: HistoricalEpisode): HistoricalReplayResult {
  const first = episode.marketPath[0];
  const last = episode.marketPath[episode.marketPath.length - 1];
  if (!first || !last) throw new Error(`Episode ${episode.id} has no market path.`);
  const priceShock = last.xlmUsd / first.xlmUsd - 1;
  if (priceShock > 0) throw new Error("Replay episodes must describe a market decline.");

  const scenario: StressScenario = {
    name: `Replay: ${episode.title}`,
    assetPriceShocks: { XLM: priceShock },
    liquidityShocks: { XLM_USDC: episode.assumed.liquidityShock },
    oracleDelaySeconds: episode.assumed.oracle.delaySeconds,
    oracle: episode.assumed.oracle,
    maxCascadeIterations: episode.assumed.maxCascadeIterations,
    maxSlippage: episode.assumed.maxSlippage,
  };

  const result = runStressTest(structuredClone(episode.startSnapshot), scenario);
  const impactPct = result.cascade.length ? Math.max(...result.cascade.map((step) => step.priceImpact)) : 0;

  const predicted = {
    liquidationVolumeUsd: result.summary.liquidationDemandUsd,
    badDebtUsd: result.summary.potentialBadDebtUsd,
    priceImpactPct: impactPct,
    cascadeDepth: result.summary.cascadeDepth,
    affectedPositions: result.summary.affectedPositions,
  };

  const inputHash = sha256({ episode, modelVersion: MODEL_VERSION });
  const warnings = [
    "Replay archive entries are reproducible model fixtures, not observed Stellar ledger state.",
    "Observed values are archived for calibration demonstration; do not treat them as live on-chain data.",
  ];

  return {
    id: `REPLAY-${inputHash.slice(0, 16).toUpperCase()}`,
    episodeId: episode.id,
    protocol: episode.protocol,
    marketId: episode.marketId,
    startLedger: episode.startLedger,
    endLedger: episode.endLedger,
    startedAt: episode.startedAt,
    generatedAt: new Date().toISOString(),
    modelVersion: MODEL_VERSION,
    predicted,
    observed: episode.observed,
    errors: {
      liquidationVolumeErrorPct: round((predicted.liquidationVolumeUsd - episode.observed.liquidationVolumeUsd) / Math.max(episode.observed.liquidationVolumeUsd, 1), 4),
      badDebtErrorPct: round((predicted.badDebtUsd - episode.observed.badDebtUsd) / Math.max(episode.observed.badDebtUsd, 1), 4),
      priceImpactDeltaPct: round((predicted.priceImpactPct - episode.observed.priceImpactPct) * 100, 2),
      cascadeDepthDelta: predicted.cascadeDepth - episode.observed.cascadeDepth,
      affectedPositionsDelta: predicted.affectedPositions - episode.observed.affectedPositions,
    },
    scenario,
    cascade: result.cascade,
    inputHash,
    warnings,
  };
}
