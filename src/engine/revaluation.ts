import { clamp, sum } from "@/core/math";
import type { Position, PositionClassification, ProtocolSnapshot, RevaluedPosition, StressScenario } from "@/core/types";

export type PriceMap = Record<string, number>;

export function basePrices(snapshot: ProtocolSnapshot): PriceMap {
  const prices: PriceMap = { USDC: 1 };
  for (const market of snapshot.markets) {
    if (market.quoteAssetId === "USDC") prices[market.baseAssetId] = market.spotPrice;
  }
  return prices;
}

export function applyPriceShocks(prices: PriceMap, scenario: StressScenario): PriceMap {
  return Object.fromEntries(Object.entries(prices).map(([asset, price]) => {
    const shock = scenario.assetPriceShocks[asset] ?? 0;
    if (shock <= -1) throw new Error(`Price shock for ${asset} must be greater than -100%.`);
    return [asset, price * (1 + shock)];
  }));
}

export function valueAmounts(amounts: Position["collateral"], prices: PriceMap): number {
  return sum(amounts.map(({ assetId, amount }) => {
    const price = prices[assetId];
    if (price === undefined) throw new Error(`Missing USD price for ${assetId}.`);
    return amount * price;
  }));
}

export function classifyHealthFactor(healthFactor: number): PositionClassification {
  if (healthFactor < 0.75) return "SEVERELY_UNDERCOLLATERALIZED";
  if (healthFactor < 1) return "LIQUIDATABLE";
  if (healthFactor < 1.15) return "AT_RISK";
  return "HEALTHY";
}

export function revaluePosition(position: Position, snapshot: ProtocolSnapshot, prices: PriceMap): RevaluedPosition {
  const collateralValueUsd = valueAmounts(position.collateral, prices);
  const debtValueUsd = valueAmounts(position.debt, prices);
  const weightedThresholdUsd = sum(position.collateral.map(({ assetId, amount }) => amount * prices[assetId] * (snapshot.risk.liquidationThreshold[assetId] ?? 0)));
  const liquidationThreshold = collateralValueUsd === 0 ? 0 : weightedThresholdUsd / collateralValueUsd;
  const healthFactor = debtValueUsd === 0 ? Number.POSITIVE_INFINITY : weightedThresholdUsd / debtValueUsd;
  const loanToValue = collateralValueUsd === 0 ? Number.POSITIVE_INFINITY : debtValueUsd / collateralValueUsd;
  return {
    ...position,
    collateralValueUsd,
    debtValueUsd,
    healthFactor,
    loanToValue,
    liquidationThreshold,
    classification: classifyHealthFactor(healthFactor),
  };
}

export function revaluePositions(snapshot: ProtocolSnapshot, prices: PriceMap): RevaluedPosition[] {
  return snapshot.positions.map((position) => revaluePosition(position, snapshot, prices));
}

export function validateScenario(scenario: StressScenario) {
  if (!scenario.name.trim()) throw new Error("Scenario name is required.");
  if (!Number.isInteger(scenario.maxCascadeIterations) || scenario.maxCascadeIterations < 1 || scenario.maxCascadeIterations > 50) throw new Error("Maximum cascade iterations must be an integer between 1 and 50.");
  if (scenario.maxSlippage < 0 || scenario.maxSlippage >= 1) throw new Error("Maximum slippage must be between 0% and 99.9%.");
  for (const [asset, shock] of Object.entries(scenario.assetPriceShocks)) {
    if (!Number.isFinite(shock) || shock <= -1 || shock > 5) throw new Error(`Invalid price shock for ${asset}.`);
  }
  for (const [market, shock] of Object.entries(scenario.liquidityShocks)) {
    if (!Number.isFinite(shock) || shock <= -1 || shock > 0) throw new Error(`Liquidity shock for ${market} must be between -100% and 0%.`);
  }
}

export function capShock(shock: number | undefined) { return clamp(shock ?? 0, -0.99, 0); }
