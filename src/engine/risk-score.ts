import { clamp, round } from "@/core/math";
import type { RiskBreakdown, RiskLevel } from "@/core/types";

export function riskLevel(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 35) return "MODERATE";
  return "LOW";
}

export function calculateRiskScore(input: {
  liquidatableCollateralUsd: number;
  totalCollateralUsd: number;
  stressedLiquidityUsd: number;
  liquidationCapacityUsd: number;
  averageSlippage: number;
  potentialBadDebtUsd: number;
  totalDebtUsd: number;
  cascadeDepth: number;
  maxIterations: number;
}): RiskBreakdown {
  const exposure = clamp(100 * input.liquidatableCollateralUsd / Math.max(input.totalCollateralUsd, 1), 0, 100);
  const coverage = clamp(100 * (1 - input.liquidationCapacityUsd / Math.max(input.liquidatableCollateralUsd, 1)), 0, 100);
  const slippage = clamp(input.averageSlippage * 500, 0, 100);
  const cascade = clamp(100 * input.cascadeDepth / Math.max(input.maxIterations, 1), 0, 100);
  const badDebt = clamp(100 * input.potentialBadDebtUsd / Math.max(input.totalDebtUsd, 1), 0, 100);
  const score = round(exposure * 0.2 + coverage * 0.25 + slippage * 0.2 + cascade * 0.15 + badDebt * 0.2, 0);
  return {
    liquidationExposure: round(exposure, 0),
    liquidityCoverage: round(coverage, 0),
    slippageRisk: round(slippage, 0),
    cascadeRisk: round(cascade, 0),
    badDebtRisk: round(badDebt, 0),
    score,
    level: riskLevel(score),
  };
}
