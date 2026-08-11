import { round, sum } from "@/core/math";
import { sha256 } from "@/core/hash";
import { assessDataQuality } from "@/engine/data-quality";
import { applyMarketImpact, executeCollateralSale, liquidityValue, stressedLiquidity } from "@/engine/liquidation";
import { applyPriceShocks, basePrices, revaluePositions, validateScenario } from "@/engine/revaluation";
import { calculateRiskScore } from "@/engine/risk-score";
import type { CascadeIteration, ExecutionEstimate, ProtocolSnapshot, RevaluedPosition, StressScenario, StressTestResult } from "@/core/types";

const isLiquidatable = (position: RevaluedPosition) => position.classification === "LIQUIDATABLE" || position.classification === "SEVERELY_UNDERCOLLATERALIZED";
export const MODEL_VERSION = "stebullx-mvp-model-v1";

export const defaultScenario: StressScenario = {
  id: "xlm-20-liquidity-40",
  name: "XLM −20% / liquidity −40%",
  assetPriceShocks: { XLM: -0.2 },
  liquidityShocks: { XLM_USDC: -0.4 },
  oracleDelaySeconds: 30,
  maxCascadeIterations: 10,
  maxSlippage: 0.1,
};

function liquidationDemand(position: RevaluedPosition, snapshot: ProtocolSnapshot, xlmPrice: number) {
  const xlmCollateral = position.collateral.find((amount) => amount.assetId === "XLM")?.amount ?? 0;
  const bonus = snapshot.risk.liquidationBonus.XLM ?? 0;
  const requestedBaseAmount = Math.min(xlmCollateral, position.debtValueUsd * (1 + bonus) / xlmPrice);
  return { requestedBaseAmount, debtUsd: position.debtValueUsd };
}

function executionCurve(state: ReturnType<typeof stressedLiquidity>, price: number): ExecutionEstimate[] {
  return [100_000, 250_000, 500_000, 1_000_000, 2_000_000].map((usd) => executeCollateralSale(state, usd / price, price).estimate);
}

function calculateCapacity(state: ReturnType<typeof stressedLiquidity>, price: number, maxSlippage: number, upperUsd: number) {
  let capacity = 0;
  // $50k grid makes the estimate readable and reproducible, rather than implying false precision.
  for (let requestedUsd = 50_000; requestedUsd <= upperUsd; requestedUsd += 50_000) {
    const estimate = executeCollateralSale(state, requestedUsd / price, price).estimate;
    if (estimate.unexecutedBaseAmount < 1e-6 && estimate.slippage <= maxSlippage) capacity = requestedUsd;
    else if (estimate.slippage > maxSlippage) break;
  }
  return capacity;
}

export function runStressTest(snapshot: ProtocolSnapshot, scenario: StressScenario): StressTestResult {
  validateScenario(scenario);
  const market = snapshot.markets.find((item) => item.id === "XLM_USDC");
  const liquidity = snapshot.liquidity.find((item) => item.marketId === "XLM_USDC");
  if (!market || !liquidity) throw new Error("The MVP requires an XLM_USDC market and liquidity snapshot.");

  const originalPrices = basePrices(snapshot);
  let prices = applyPriceShocks(originalPrices, scenario);
  const initialPrice = prices.XLM;
  const priceMultiplier = initialPrice / originalPrices.XLM;
  const liquidityShock = scenario.liquidityShocks.XLM_USDC ?? 0;
  const initialLiquidityState = stressedLiquidity(liquidity, liquidityShock, priceMultiplier);
  let liquidityState = initialLiquidityState;

  const initialRevalued = revaluePositions(snapshot, prices);
  const initiallyLiquidatable = initialRevalued.filter(isLiquidatable);
  const totalCollateralUsd = sum(initialRevalued.map((position) => position.collateralValueUsd));
  const totalDebtUsd = sum(initialRevalued.map((position) => position.debtValueUsd));
  const liquidationExposureUsd = sum(initiallyLiquidatable.map((position) => position.collateralValueUsd));
  const firstDemandUsd = sum(initiallyLiquidatable.map((position) => liquidationDemand(position, snapshot, prices.XLM).requestedBaseAmount * prices.XLM));
  const curve = executionCurve(initialLiquidityState, initialPrice);
  const liquidationCapacityUsd = calculateCapacity(initialLiquidityState, initialPrice, scenario.maxSlippage, Math.max(firstDemandUsd, 2_000_000));

  const processed = new Set<string>();
  const cascade: CascadeIteration[] = [];
  let recoveredUsd = 0;
  let badDebtUsd = 0;
  let liquidatableCollateralUsd = 0;

  for (let iteration = 0; iteration < scenario.maxCascadeIterations; iteration += 1) {
    const revalued = revaluePositions(snapshot, prices);
    const newlyLiquidatable = revalued.filter((position) => isLiquidatable(position) && !processed.has(position.id));
    if (newlyLiquidatable.length === 0) break;
    newlyLiquidatable.forEach((position) => processed.add(position.id));

    const demands = newlyLiquidatable.map((position) => liquidationDemand(position, snapshot, prices.XLM));
    const requestedBaseAmount = sum(demands.map((demand) => demand.requestedBaseAmount));
    const debtToRecoverUsd = sum(demands.map((demand) => demand.debtUsd));
    const execution = executeCollateralSale(liquidityState, requestedBaseAmount, prices.XLM);
    liquidatableCollateralUsd += requestedBaseAmount * prices.XLM;
    recoveredUsd += execution.estimate.recoveredUsd;
    badDebtUsd += Math.max(0, debtToRecoverUsd - execution.estimate.recoveredUsd);
    liquidityState = applyMarketImpact(execution.remaining, execution.estimate.priceImpact);

    // Re-anchor the next round at the realized liquidation price. This is a model
    // feedback rule, not a claim about an oracle update or a market guarantee.
    if (execution.estimate.averageExecutionPrice > 0) prices = { ...prices, XLM: Math.min(prices.XLM, execution.estimate.averageExecutionPrice) };
    cascade.push({
      iteration,
      newlyLiquidatable: newlyLiquidatable.length,
      totalLiquidatable: processed.size,
      collateralSoldXlm: round(execution.estimate.executedBaseAmount, 2),
      recoveredUsd: round(execution.estimate.recoveredUsd),
      estimatedBadDebtUsd: round(badDebtUsd),
      marketPriceUsd: round(prices.XLM, 6),
      priceImpact: round(execution.estimate.priceImpact, 4),
      remainingDepthUsd: round(liquidityValue(liquidityState)),
    });
    if (execution.estimate.executedBaseAmount === 0) break;
  }

  const finalPositions = revaluePositions(snapshot, prices);
  const affected = new Set(finalPositions.filter((position) => position.classification !== "HEALTHY").map((position) => position.id));
  processed.forEach((id) => affected.add(id));
  const risk = calculateRiskScore({
    liquidatableCollateralUsd,
    totalCollateralUsd,
    stressedLiquidityUsd: liquidityValue(initialLiquidityState),
    liquidationCapacityUsd,
    averageSlippage: cascade.length ? sum(cascade.map((step) => step.priceImpact)) / cascade.length : 0,
    potentialBadDebtUsd: badDebtUsd,
    totalDebtUsd,
    cascadeDepth: cascade.length,
    maxIterations: scenario.maxCascadeIterations,
  });

  const dataQuality = assessDataQuality(snapshot);
  const scenarioHash = sha256(scenario);
  const inputHash = sha256({ snapshot, scenario, modelVersion: MODEL_VERSION });
  const deterministicId = `STRESS-${inputHash.slice(0, 16).toUpperCase()}`;
  const result: StressTestResult = {
    id: deterministicId,
    protocol: snapshot.protocol,
    market: market.id,
    scenario,
    data: snapshot.provenance,
    generatedAt: new Date().toISOString(),
    summary: {
      totalPositions: snapshot.positions.length,
      affectedPositions: affected.size,
      liquidatablePositions: processed.size,
      liquidationExposureUsd: round(liquidationExposureUsd),
      liquidationDemandUsd: round(liquidatableCollateralUsd),
      liquidatableCollateralUsd: round(liquidatableCollateralUsd),
      estimatedRecoverableValueUsd: round(recoveredUsd),
      potentialBadDebtUsd: round(badDebtUsd),
      stressLossUsd: round(badDebtUsd),
      normalLiquidityUsd: round(market.executableDepthUsd),
      stressedLiquidityUsd: round(liquidityValue(initialLiquidityState)),
      liquidationCapacityUsd: round(liquidationCapacityUsd),
      cascadeDepth: cascade.length,
    },
    risk,
    dataQuality,
    audit: {
      deterministicId,
      inputHash,
      scenarioHash,
      resultHash: "",
      sourceLedger: snapshot.provenance.ledger,
      modelVersion: MODEL_VERSION,
    },
    positions: finalPositions,
    executionCurve: curve.map((estimate) => ({ ...estimate, requestedBaseAmount: round(estimate.requestedBaseAmount), executedBaseAmount: round(estimate.executedBaseAmount), recoveredUsd: round(estimate.recoveredUsd), averageExecutionPrice: round(estimate.averageExecutionPrice, 6), priceImpact: round(estimate.priceImpact, 4), slippage: round(estimate.slippage, 4), unexecutedBaseAmount: round(estimate.unexecutedBaseAmount) })),
    cascade,
    assumptions: [
      "DEMO mode uses a deterministic, hand-authored Blend/XLM-USDC fixture. No result represents live Blend borrower data.",
      "USD valuations use the scenario-adjusted XLM/USD reference and USDC = $1.00; stablecoin depeg risk is outside this MVP unless configured as an asset shock.",
      "Order-book fills consume modeled bid levels in price order, then use a constant-product AMM approximation with the configured fee.",
      "Liquidity shock scales executable depth and AMM reserves. Residual quotes are repriced after each cascade round using 45% of realized execution impact.",
      `Liquidation capacity is the largest $50k-grid sale with ≤ ${(scenario.maxSlippage * 100).toFixed(1)}% modeled slippage; it is an estimate, not a market guarantee.`,
      "A liquidatable position is processed once per run; unrecovered debt is the modeled shortfall between that group’s debt and recovered sale proceeds.",
      "SteBullX provides modeled risk estimates and does not guarantee protocol solvency, liquidation outcomes, or future market behavior.",
    ],
    methodologyVersion: MODEL_VERSION,
  };
  result.audit.resultHash = sha256({
    audit: { inputHash, scenarioHash, modelVersion: MODEL_VERSION },
    summary: result.summary,
    risk: result.risk,
    dataQuality: result.dataQuality,
    positions: result.positions,
    executionCurve: result.executionCurve,
    cascade: result.cascade,
    assumptions: result.assumptions,
  });
  return result;
}
