import { describe, expect, it } from "vitest";
import { demoBlendSnapshot } from "@/data/demo-blend-snapshot";
import { replayArchive } from "@/data/historical-archive";
import { replayEpisode } from "@/engine/replay";
import { executeCollateralSale, liquidityValue, poolTouchPrice, stressedLiquidity } from "@/engine/liquidation";
import { applyPriceShocks, oracleReportedPrice, revaluePosition, resolveOracle } from "@/engine/revaluation";
import { defaultScenario, runStressTest } from "@/engine/simulation";

describe("position revaluation", () => {
  it("applies a -20% XLM price shock and recalculates health factor", () => {
    const snapshot = structuredClone(demoBlendSnapshot);
    const position = { id: "deterministic", collateral: [{ assetId: "XLM", amount: 1_000 }], debt: [{ assetId: "USDC", amount: 250 }] };
    const prices = applyPriceShocks({ XLM: 0.4, USDC: 1 }, { ...defaultScenario, assetPriceShocks: { XLM: -0.2 } });
    const revalued = revaluePosition(position, snapshot, prices);
    expect(prices.XLM).toBeCloseTo(0.32, 8);
    expect(revalued.collateralValueUsd).toBeCloseTo(320, 8);
    expect(revalued.healthFactor).toBeCloseTo(1.088, 8); // 1000 × $0.32 × 0.85 / $250
    expect(revalued.classification).toBe("AT_RISK");
  });

  it("marks a position below the liquidation threshold as liquidatable", () => {
    const position = { id: "threshold", collateral: [{ assetId: "XLM", amount: 1_000 }], debt: [{ assetId: "USDC", amount: 280 }] };
    const revalued = revaluePosition(position, demoBlendSnapshot, { XLM: 0.32, USDC: 1 });
    expect(revalued.healthFactor).toBeLessThan(1);
    expect(revalued.classification).toBe("LIQUIDATABLE");
  });
});

describe("liquidation execution", () => {
  it("consumes depth in price priority and reports slippage", () => {
    const state = stressedLiquidity({ marketId: "XLM_USDC", bidLevels: [{ price: 1, baseAmount: 100 }, { price: 0.8, baseAmount: 100 }], provenance: demoBlendSnapshot.provenance }, 0, 1);
    const execution = executeCollateralSale(state, 150, 1).estimate;
    expect(execution.recoveredUsd).toBeCloseTo(140, 8);
    expect(execution.averageExecutionPrice).toBeCloseTo(140 / 150, 8);
    expect(execution.priceImpact).toBeCloseTo(1 - 140 / 150, 8);
    expect(execution.unexecutedBaseAmount).toBe(0);
  });

  it("applies a liquidity shock to executable order-book size", () => {
    const state = stressedLiquidity({ marketId: "XLM_USDC", bidLevels: [{ price: 1, baseAmount: 100 }], provenance: demoBlendSnapshot.provenance }, -0.4, 1);
    expect(state.bidLevels[0].baseAmount).toBeCloseTo(60, 8);
  });

  it("routes across the book and multiple AMM pools in price priority", () => {
    const state = stressedLiquidity({
      marketId: "XLM_USDC",
      bidLevels: [{ price: 1, baseAmount: 100 }],
      amms: [
        { id: "AMM:a", baseReserve: 100_000, quoteReserve: 100_000, feeBps: 30 },
        { id: "AMM:b", baseReserve: 60_000, quoteReserve: 60_000, feeBps: 30 },
      ],
      provenance: demoBlendSnapshot.provenance,
    }, 0, 1);
    const execution = executeCollateralSale(state, 400_000, 1).estimate;
    expect(execution.unexecutedBaseAmount).toBe(0);
    expect(execution.venues.some((venue) => venue.venueId === "SDEX")).toBe(true);
    expect(execution.venues.some((venue) => venue.venueId === "AMM:a")).toBe(true);
    expect(execution.venues.some((venue) => venue.venueId === "AMM:b")).toBe(true);
    const sumQuote = execution.venues.reduce((acc, venue) => acc + venue.quoteUsd, 0);
    expect(sumQuote).toBeCloseTo(execution.recoveredUsd, 6);
    expect(execution.recoveredUsd).toBeLessThan(400_000); // price impact, not spot
  });

  it("capped AMM participation bounds modeled executable value", () => {
    const state = stressedLiquidity({
      marketId: "XLM_USDC",
      bidLevels: [],
      amms: [{ id: "AMM:single", baseReserve: 1_000_000, quoteReserve: 400_000, feeBps: 30 }],
      provenance: demoBlendSnapshot.provenance,
    }, 0, 1);
    expect(liquidityValue(state)).toBeCloseTo(400_000 * 0.75, 6);
    const estimate = executeCollateralSale(state, 10_000_000, 1).estimate;
    expect(estimate.recoveredUsd).toBeLessThanOrEqual(400_000 * 0.75);
  });

  it("reports per-venue breakdown and pool touch prices", () => {
    const state = stressedLiquidity({ marketId: "XLM_USDC", bidLevels: [], amms: [{ id: "AMM:p", baseReserve: 2000, quoteReserve: 1000, feeBps: 50 }], provenance: demoBlendSnapshot.provenance }, 0, 1);
    expect(poolTouchPrice(state.amms[0])).toBeCloseTo(0.995 * 0.5, 6);
  });
});

describe("oracle model", () => {
  it("reports the pre-shock price during the lag window, then converges", () => {
    const oracle = { delaySeconds: 10, rampSeconds: 20, divergence: 0, staleAfterSeconds: 0, failure: false };
    expect(oracleReportedPrice(1, 0.5, oracle, 0)).toBe(1); // reading time = 0
    expect(oracleReportedPrice(1, 0.5, oracle, 10)).toBe(1); // reading time = 0
    expect(oracleReportedPrice(1, 0.5, oracle, 20)).toBeCloseTo(0.75, 6); // reading = 10 → halfway
    expect(oracleReportedPrice(1, 0.5, oracle, 30)).toBeCloseTo(0.5, 6); // fully converged
  });

  it("applies divergence bias and freezes on staleness", () => {
    const oracle = { delaySeconds: 0, rampSeconds: 1, divergence: 0.05, staleAfterSeconds: 10, failure: false };
    expect(oracleReportedPrice(1, 0.5, oracle, 20)).toBeCloseTo(0.525, 6); // frozen at t=10, +5% bias
  });

  it("stays frozen at the pre-shock price on failure", () => {
    const oracle = { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: true };
    expect(oracleReportedPrice(1, 0.5, oracle, 500)).toBe(1);
  });

  it("back-compat: oracleDelaySeconds maps into the oracle config", () => {
    const { oracle: _dropped, ...legacy } = defaultScenario;
    const resolved = resolveOracle({ ...legacy, oracleDelaySeconds: 120 } as typeof defaultScenario);
    expect(resolved.delaySeconds).toBe(120);
  });

  it("a lagging oracle spreads liquidations across cascade rounds and records both prices", () => {
    const result = runStressTest(structuredClone(demoBlendSnapshot), { ...defaultScenario, oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false } });
    expect(result.cascade.length).toBeGreaterThan(0);
    for (const step of result.cascade) {
      expect(step.oraclePriceUsd).toBeGreaterThanOrEqual(step.marketPriceUsd);
      expect(step.marketPriceUsd).toBeGreaterThan(0);
    }
    expect(result.oracle.delaySeconds).toBe(30);
    expect(result.assumptions.join(" ")).toContain("Oracle model");
  });

  it("an oracle failure freezes valuations at the pre-shock price", () => {
    const failed = runStressTest(structuredClone(demoBlendSnapshot), { ...defaultScenario, oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: true } });
    expect(failed.cascade.every((step) => step.oraclePriceUsd === 0.4)).toBe(true);
  });
});

describe("historical replay", () => {
  it("replays an archived episode and reports prediction-vs-observed errors", () => {
    const replay = replayEpisode(replayArchive[0]);
    expect(replay.id.startsWith("REPLAY-")).toBe(true);
    expect(replay.startLedger).toBe(12_842_192);
    expect(replay.endLedger).toBe(12_842_412);
    expect(replay.scenario.assetPriceShocks.XLM).toBeCloseTo(0.32 / 0.4 - 1, 8);
    expect(replay.predicted.liquidationVolumeUsd).toBeGreaterThan(0);
    expect(typeof replay.errors.liquidationVolumeErrorPct).toBe("number");
    expect(replay.errors.cascadeDepthDelta).toBe(replay.predicted.cascadeDepth - replay.observed.cascadeDepth);
    expect(replay.warnings[0]).toContain("fixture");
  });

  it("is deterministic for the same episode", () => {
    const first = replayEpisode(replayArchive[1]);
    const second = replayEpisode(replayArchive[1]);
    expect(first.predicted).toEqual(second.predicted);
    expect(first.id).toBe(second.id);
    expect(first.errors).toEqual(second.errors);
  });

  it("rejects ascending market paths", () => {
    const ascending = structuredClone(replayArchive[2]);
    ascending.marketPath = [{ ledger: 1, xlmUsd: 0.4 }, { ledger: 2, xlmUsd: 0.45 }];
    expect(() => replayEpisode(ascending)).toThrow("market decline");
  });
});

describe("cascade and scoring", () => {
  it("is deterministic for an identical snapshot and scenario", () => {
    const first = runStressTest(structuredClone(demoBlendSnapshot), defaultScenario);
    const second = runStressTest(structuredClone(demoBlendSnapshot), defaultScenario);
    expect(first.summary).toEqual(second.summary);
    expect(first.risk).toEqual(second.risk);
    expect(first.cascade).toEqual(second.cascade);
    expect(first.id).toBe(second.id);
    expect(first.audit.inputHash).toBe(second.audit.inputHash);
    expect(first.audit.resultHash).toBe(second.audit.resultHash);
    expect(first.summary.liquidationCapacityUsd).toBeGreaterThanOrEqual(0);
    expect(first.risk.score).toBeGreaterThanOrEqual(0);
    expect(first.risk.score).toBeLessThanOrEqual(100);
  });

  it("reports low confidence for demo inputs rather than implying live-data certainty", () => {
    const result = runStressTest(structuredClone(demoBlendSnapshot), defaultScenario);
    expect(result.dataQuality.level).toBe("LOW");
    expect(result.dataQuality.warnings[0]).toContain("DEMO fixture");
    expect(result.summary.stressLossUsd).toBe(result.summary.potentialBadDebtUsd);
  });
});
