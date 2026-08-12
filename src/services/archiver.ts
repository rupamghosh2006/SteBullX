import { clamp, sum } from "@/core/math";
import { basePrices, DEFAULT_ORACLE, revaluePositions } from "@/engine/revaluation";
import { executeCollateralSale, stressedLiquidity } from "@/engine/liquidation";
import { appendArchivedEpisode, listArchivedEpisodes } from "@/services/archive-store";
import { resolveBlendSnapshot } from "@/services/data-source";
import { info, warn } from "@/services/observability";
import type { HistoricalEpisode, ProtocolSnapshot, RevaluedPosition } from "@/core/types";

const isLiquidatable = (position: RevaluedPosition) => position.classification === "LIQUIDATABLE" || position.classification === "SEVERELY_UNDERCOLLATERALIZED";

function xlmPriceOf(snapshot: ProtocolSnapshot): number {
  const market = snapshot.markets.find((item) => item.id === "XLM_USDC");
  if (!market) throw new Error("Snapshot has no XLM_USDC market; cannot archive it.");
  return market.spotPrice;
}

function executableDepthOf(snapshot: ProtocolSnapshot): number {
  const market = snapshot.markets.find((item) => item.id === "XLM_USDC");
  if (market) return market.executableDepthUsd;
  const liquidity = snapshot.liquidity.find((item) => item.marketId === "XLM_USDC");
  if (liquidity) return sum(liquidity.bidLevels.map((level) => level.price * level.baseAmount));
  return 0;
}

/**
 * Observed-outcome estimation from consecutive archived snapshots. These are
 * model-derived observations (INDEXED snapshots revalued by the engine), not
 * on-chain liquidation events; the note on every episode says so. When a
 * liquidation-event indexer is available, replace this with the recorded events.
 */
export function observeBetween(prev: ProtocolSnapshot, next: ProtocolSnapshot) {
  const startPrice = xlmPriceOf(prev);
  const endPrice = xlmPriceOf(next);
  const prices = { ...basePrices(prev), XLM: endPrice };
  const revalued = revaluePositions(prev, prices);
  const liquidatable = revalued.filter(isLiquidatable);
  const bonus = prev.risk.liquidationBonus.XLM ?? 0;
  const liquidationVolumeUsd = sum(liquidatable.map((position) => {
    const xlmCollateral = position.collateral.find((amount) => amount.assetId === "XLM")?.amount ?? 0;
    const requestedBaseAmount = Math.min(xlmCollateral, position.debtValueUsd * (1 + bonus) / endPrice);
    return requestedBaseAmount * endPrice;
  }));
  const debtToRecoverUsd = sum(liquidatable.map((position) => position.debtValueUsd));
  const currentLiquidity = next.liquidity.find((item) => item.marketId === "XLM_USDC");
  const state = currentLiquidity ? stressedLiquidity(currentLiquidity, 0, 1) : undefined;
  const recoveredUsd = state ? executeCollateralSale(state, liquidationVolumeUsd / endPrice, endPrice).estimate.recoveredUsd : 0;
  const affectedPositions = revalued.filter((position) => position.classification !== "HEALTHY").length;
  const priceDrop = startPrice > 0 ? (startPrice - endPrice) / startPrice : 0;
  return {
    liquidationVolumeUsd: Math.round(liquidationVolumeUsd),
    badDebtUsd: Math.round(Math.max(0, debtToRecoverUsd - recoveredUsd)),
    priceImpactPct: Math.max(0, priceDrop),
    cascadeDepth: liquidatable.length > 0 ? 1 : 0,
    affectedPositions,
    note: liquidatable.length > 0 && !currentLiquidity
      ? "liquidatable positions detected but no liquidity snapshot was archived; bad debt is 0 and cascade depth is approximate."
      : undefined,
  };
}

/**
 * Captures the current resolved snapshot as a HISTORICAL episode, measures the
 * move against the previous archive, and persists it via the tiered store.
 * Run `npm run archive` on a schedule (DATA_SOURCE=live required).
 * The purpose is model calibration: replay engines predict, archives observe.
 */
export async function captureEpisode(): Promise<HistoricalEpisode> {
  const snapshot = await resolveBlendSnapshot();
  const ledger = snapshot.provenance.ledger ?? 0;
  const capturedAt = snapshot.provenance.capturedAt;
  const price = xlmPriceOf(snapshot);
  const previous = (await listArchivedEpisodes())
    .filter((episode) => episode.protocol === snapshot.protocol && episode.marketId === "XLM_USDC" && episode.endLedger < ledger)
    .sort((a, b) => b.endLedger - a.endLedger)[0];

  const marketPath = previous
    ? [...previous.marketPath, { ledger, xlmUsd: price }]
    : [{ ledger: ledger || 1, xlmUsd: price }];

  const prevDepth = previous ? executableDepthOf(previous.startSnapshot) : 0;
  const curDepth = executableDepthOf(snapshot);
  const liquidityShock = previous && prevDepth > 0 ? clamp((prevDepth - curDepth) / prevDepth, -0.99, 1) : 0;

  const observed = previous ? observeBetween(previous.startSnapshot, snapshot) : {
    liquidationVolumeUsd: 0,
    badDebtUsd: 0,
    priceImpactPct: 0,
    cascadeDepth: 0,
    affectedPositions: 0,
  };

  const id = `archive-${ledger || Math.floor(Date.now() / 1000)}`;
  const episode: HistoricalEpisode = {
    id,
    protocol: "blend",
    marketId: "XLM_USDC",
    title: `Indexed Blend snapshot @ ledger ${ledger || "unknown"}`,
    startLedger: previous?.startLedger ?? ledger,
    endLedger: ledger,
    startedAt: previous?.startedAt ?? capturedAt,
    startSnapshot: previous?.startSnapshot ?? snapshot,
    marketPath,
    assumed: {
      liquidityShock: Math.round(liquidityShock * 1000) / 1000,
      oracle: DEFAULT_ORACLE,
      maxCascadeIterations: 10,
      maxSlippage: 0.1,
    },
    observed,
    note: "CAPTURED ARCHIVE: state captured at capture time via the resolved data source; observed values are model-derived from consecutive snapshots, not on-chain liquidation events.",
  };
  await appendArchivedEpisode(episode);
  info("archive.captured", { id, ledger, price, positions: snapshot.positions.length, liquidityShock, observed });
  return episode;
}