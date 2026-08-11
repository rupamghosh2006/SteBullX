import { describe, expect, it } from "vitest";
import { demoBlendSnapshot } from "@/data/demo-blend-snapshot";
import { executeCollateralSale, stressedLiquidity } from "@/engine/liquidation";
import { applyPriceShocks, revaluePosition } from "@/engine/revaluation";
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
