import { sum } from "@/core/math";
import { demoBlendSnapshot } from "@/data/demo-blend-snapshot";
import { runStressTest, MODEL_VERSION } from "@/engine/simulation";
import type { StressTestResult } from "@/core/types";

export const fixtureSnapshot = demoBlendSnapshot;

export const PRESETS = {
  mild: { name: "XLM −10% / liquidity −20%", assetPriceShocks: { XLM: -0.1 }, liquidityShocks: { XLM_USDC: -0.2 } },
  severe: { name: "XLM −20% / liquidity −40%", assetPriceShocks: { XLM: -0.2 }, liquidityShocks: { XLM_USDC: -0.4 } },
  extreme: { name: "XLM −30% / liquidity −50%", assetPriceShocks: { XLM: -0.3 }, liquidityShocks: { XLM_USDC: -0.5 } },
} as const;

function canned(price: number, liquidity: number, label: string): StressTestResult {
  return runStressTest(structuredClone(demoBlendSnapshot), {
    name: label,
    assetPriceShocks: { XLM: price },
    liquidityShocks: { XLM_USDC: liquidity },
    oracleDelaySeconds: 30,
    oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false },
    maxCascadeIterations: 10,
    maxSlippage: 0.1,
  });
}

export const cannedRuns: Record<"mild" | "severe" | "extreme", StressTestResult> = {
  mild: canned(-0.1, -0.2, "XLM −10% / liquidity −20%"),
  severe: canned(-0.2, -0.4, "XLM −20% / liquidity −40%"),
  extreme: canned(-0.3, -0.5, "XLM −30% / liquidity −50%"),
};

export const totalCollateralUsd = sum(demoBlendSnapshot.positions.map((position) => position.collateral.reduce((acc, amount) => acc + amount.amount * (amount.assetId === "XLM" ? 0.4 : 1), 0)));
export const totalDebtUsd = sum(demoBlendSnapshot.positions.map((position) => position.debt.reduce((acc, amount) => acc + amount.amount * 1, 0)));

export const modelVersion = MODEL_VERSION;
