import { clamp, sum } from "@/core/math";
import type { OracleScenario, Position, PositionClassification, ProtocolSnapshot, RevaluedPosition, StressScenario } from "@/core/types";

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

export const DEFAULT_ORACLE: OracleScenario = { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false };

/** Back-compat: a bare oracleDelaySeconds still produces a working oracle model. */
export function resolveOracle(scenario: StressScenario): OracleScenario {
  return {
    delaySeconds: scenario.oracle?.delaySeconds ?? scenario.oracleDelaySeconds ?? DEFAULT_ORACLE.delaySeconds,
    rampSeconds: scenario.oracle?.rampSeconds ?? DEFAULT_ORACLE.rampSeconds,
    divergence: scenario.oracle?.divergence ?? DEFAULT_ORACLE.divergence,
    staleAfterSeconds: scenario.oracle?.staleAfterSeconds ?? DEFAULT_ORACLE.staleAfterSeconds,
    failure: scenario.oracle?.failure ?? DEFAULT_ORACLE.failure,
  };
}

/**
 * Oracle convergence curve: the reported price moves linearly from the
 * pre-shock price to the shocked price over rampSeconds. The oracle reads
 * the curve at (lastUpdate - delay), i.e. it lags the true market price.
 */
export function oracleReportedPrice(basePrice: number, shockedPrice: number, oracle: OracleScenario, elapsedSeconds: number): number {
  if (oracle.failure) return basePrice;
  const lastUpdate = oracle.staleAfterSeconds > 0 ? Math.min(elapsedSeconds, oracle.staleAfterSeconds) : elapsedSeconds;
  const readingTime = Math.max(0, lastUpdate - oracle.delaySeconds);
  const progress = oracle.rampSeconds > 0 ? clamp(readingTime / oracle.rampSeconds, 0, 1) : 1;
  const converged = basePrice + (shockedPrice - basePrice) * progress;
  return converged * (1 + oracle.divergence);
}

/** True price after the full shock has propagated; oracle lags separately. */
export function shockedPrices(base: PriceMap, scenario: StressScenario): PriceMap {
  return applyPriceShocks(base, scenario);
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
  const oracle = resolveOracle(scenario);
  if (!Number.isFinite(oracle.delaySeconds) || oracle.delaySeconds < 0 || oracle.delaySeconds > 3600) throw new Error("Oracle delay must be between 0 and 3600 seconds.");
  if (!Number.isFinite(oracle.rampSeconds) || oracle.rampSeconds < 0 || oracle.rampSeconds > 3600) throw new Error("Oracle ramp must be between 0 and 3600 seconds.");
  if (!Number.isFinite(oracle.divergence) || Math.abs(oracle.divergence) > 0.5) throw new Error("Oracle divergence must be between -50% and +50%.");
  if (!Number.isFinite(oracle.staleAfterSeconds) || oracle.staleAfterSeconds < 0 || oracle.staleAfterSeconds > 3600) throw new Error("Oracle staleness window must be between 0 and 3600 seconds.");
}

export function capShock(shock: number | undefined) { return clamp(shock ?? 0, -0.99, 0); }
