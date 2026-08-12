import type { HistoricalEpisode } from "@/core/types";
import { demoBlendSnapshot } from "./demo-blend-snapshot";
import { listArchivedEpisodes, getArchivedEpisode } from "@/services/archive-store";

/**
 * Deterministic, hand-authored replay archive. Entries are explicitly labelled
 * model fixtures: they exist to exercise the historical-replay and calibration
 * workflow, not to claim archived Stellar/Blend mainnet state.
 */
function archivedSnapshot(ledger: number, title: string) {
  return {
    ...structuredClone(demoBlendSnapshot),
    provenance: {
      kind: "HISTORICAL" as const,
      source: `SteBullX simulated replay archive: ${title}`,
      capturedAt: "2026-07-15T00:00:00.000Z",
      ledger,
      note: "ARCHIVE FIXTURE. Reconstructed for the replay workflow; not observed ledger state.",
    },
  };
}

export const replayArchive: HistoricalEpisode[] = [
  {
    id: "episode-xlm-20-feb-2026",
    protocol: "blend",
    marketId: "XLM_USDC",
    title: "XLM −20% / liquidity −40% (Feb 2026)",
    startLedger: 12_842_192,
    endLedger: 12_842_412,
    startedAt: "2026-02-14T08:00:00.000Z",
    startSnapshot: archivedSnapshot(12_842_192, "XLM -20% episode"),
    marketPath: [
      { ledger: 12_842_192, xlmUsd: 0.4 },
      { ledger: 12_842_232, xlmUsd: 0.372 },
      { ledger: 12_842_272, xlmUsd: 0.352 },
      { ledger: 12_842_312, xlmUsd: 0.338 },
      { ledger: 12_842_352, xlmUsd: 0.326 },
      { ledger: 12_842_412, xlmUsd: 0.32 },
    ],
    assumed: {
      liquidityShock: -0.4,
      oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false },
      maxCascadeIterations: 10,
      maxSlippage: 0.1,
    },
    observed: {
      liquidationVolumeUsd: 3_610_000,
      badDebtUsd: 1_180_000,
      priceImpactPct: 0.486,
      cascadeDepth: 4,
      affectedPositions: 18,
    },
    note: "ARCHIVE FIXTURE with observed values offset from model output to exercise calibration error tracking.",
  },
  {
    id: "episode-xlm-30-may-2026",
    protocol: "blend",
    marketId: "XLM_USDC",
    title: "XLM −30% / liquidity −50% (May 2026)",
    startLedger: 13_104_008,
    endLedger: 13_104_228,
    startedAt: "2026-05-03T14:30:00.000Z",
    startSnapshot: archivedSnapshot(13_104_008, "XLM -30% episode"),
    marketPath: [
      { ledger: 13_104_008, xlmUsd: 0.42 },
      { ledger: 13_104_048, xlmUsd: 0.38 },
      { ledger: 13_104_088, xlmUsd: 0.35 },
      { ledger: 13_104_128, xlmUsd: 0.33 },
      { ledger: 13_104_168, xlmUsd: 0.315 },
      { ledger: 13_104_228, xlmUsd: 0.294 },
    ],
    assumed: {
      liquidityShock: -0.5,
      oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false },
      maxCascadeIterations: 10,
      maxSlippage: 0.1,
    },
    observed: {
      liquidationVolumeUsd: 4_210_000,
      badDebtUsd: 3_120_000,
      priceImpactPct: 0.71,
      cascadeDepth: 5,
      affectedPositions: 20,
    },
    note: "ARCHIVE FIXTURE. Deep drawdown with heavy liquidity withdrawal; oracle lag is a modeled driver.",
  },
  {
    id: "episode-xlm-10-sep-2026",
    protocol: "blend",
    marketId: "XLM_USDC",
    title: "XLM −10% / liquidity −20% (Sep 2026)",
    startLedger: 13_511_300,
    endLedger: 13_511_500,
    startedAt: "2026-09-09T09:45:00.000Z",
    startSnapshot: archivedSnapshot(13_511_300, "XLM -10% episode"),
    marketPath: [
      { ledger: 13_511_300, xlmUsd: 0.41 },
      { ledger: 13_511_360, xlmUsd: 0.39 },
      { ledger: 13_511_420, xlmUsd: 0.377 },
      { ledger: 13_511_500, xlmUsd: 0.369 },
    ],
    assumed: {
      liquidityShock: -0.2,
      oracle: { delaySeconds: 15, rampSeconds: 20, divergence: 0, staleAfterSeconds: 0, failure: false },
      maxCascadeIterations: 10,
      maxSlippage: 0.1,
    },
    observed: {
      liquidationVolumeUsd: 1_240_000,
      badDebtUsd: 210_000,
      priceImpactPct: 0.19,
      cascadeDepth: 2,
      affectedPositions: 12,
    },
    note: "ARCHIVE FIXTURE. Mild episode: shallow cascade, small residual bad debt.",
  },
];

/** Merges the hand-authored fixture archive with state captured by `npm run archive`. */
export async function listEpisodes(): Promise<HistoricalEpisode[]> {
  const archived = await listArchivedEpisodes();
  const ids = new Set(archived.map((episode) => episode.id));
  return [...replayArchive.filter((episode) => !ids.has(episode.id)), ...archived];
}

export async function getEpisode(id: string): Promise<HistoricalEpisode | undefined> {
  return replayArchive.find((episode) => episode.id === id) ?? getArchivedEpisode(id);
}
