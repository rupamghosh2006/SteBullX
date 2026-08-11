import { clamp, sum } from "@/core/math";
import type { ExecutionEstimate, LiquiditySnapshot, OrderBookLevel } from "@/core/types";

export interface ExecutionLiquidityState {
  bidLevels: OrderBookLevel[];
  amm?: { baseReserve: number; quoteReserve: number; feeBps: number };
}

export function stressedLiquidity(snapshot: LiquiditySnapshot, liquidityShock: number, priceMultiplier: number): ExecutionLiquidityState {
  const factor = clamp(1 + liquidityShock, 0.01, 1);
  return {
    bidLevels: snapshot.bidLevels.map((level) => ({ price: level.price * priceMultiplier, baseAmount: level.baseAmount * factor })),
    amm: snapshot.amm ? {
      baseReserve: snapshot.amm.baseReserve * factor,
      quoteReserve: snapshot.amm.quoteReserve * factor * priceMultiplier,
      feeBps: snapshot.amm.feeBps,
    } : undefined,
  };
}

export function liquidityValue(state: ExecutionLiquidityState): number {
  const book = sum(state.bidLevels.map((level) => level.baseAmount * level.price));
  // AMM quote reserve is a conservative upper bound, not a guaranteed executable value.
  return book + (state.amm?.quoteReserve ?? 0);
}

export function executeCollateralSale(state: ExecutionLiquidityState, requestedBaseAmount: number, referencePrice: number): { estimate: ExecutionEstimate; remaining: ExecutionLiquidityState } {
  let remainingToSell = Math.max(0, requestedBaseAmount);
  let executed = 0;
  let recovered = 0;
  const remainingLevels: OrderBookLevel[] = [];
  for (const level of state.bidLevels) {
    const fill = Math.min(level.baseAmount, remainingToSell);
    executed += fill;
    recovered += fill * level.price;
    remainingToSell -= fill;
    const left = level.baseAmount - fill;
    if (left > 1e-9) remainingLevels.push({ ...level, baseAmount: left });
  }
  let amm = state.amm ? { ...state.amm } : undefined;
  if (remainingToSell > 1e-9 && amm && amm.baseReserve > 0 && amm.quoteReserve > 0) {
    const fee = amm.feeBps / 10_000;
    // Constant-product AMM execution: quote out = y - k / (x + dx*(1-fee)).
    const dx = remainingToSell;
    const effectiveDx = dx * (1 - fee);
    const k = amm.baseReserve * amm.quoteReserve;
    const newBase = amm.baseReserve + effectiveDx;
    const newQuote = k / newBase;
    const quoteOut = Math.max(0, amm.quoteReserve - newQuote);
    executed += dx;
    recovered += quoteOut;
    amm = { ...amm, baseReserve: amm.baseReserve + dx, quoteReserve: newQuote };
    remainingToSell = 0;
  }
  const averageExecutionPrice = executed === 0 ? 0 : recovered / executed;
  const priceImpact = referencePrice === 0 ? 0 : clamp(1 - averageExecutionPrice / referencePrice, 0, 1);
  return {
    estimate: {
      requestedBaseAmount,
      executedBaseAmount: executed,
      recoveredUsd: recovered,
      averageExecutionPrice,
      referencePrice,
      priceImpact,
      slippage: priceImpact,
      unexecutedBaseAmount: Math.max(0, requestedBaseAmount - executed),
    },
    remaining: { bidLevels: remainingLevels, amm },
  };
}

/** Reprices residual venue quotes after a completed liquidation round. */
export function applyMarketImpact(state: ExecutionLiquidityState, priceImpact: number): ExecutionLiquidityState {
  const multiplier = 1 - clamp(priceImpact * 0.45, 0, 0.35);
  return {
    bidLevels: state.bidLevels.map((level) => ({ ...level, price: level.price * multiplier })),
    amm: state.amm ? { ...state.amm, quoteReserve: state.amm.quoteReserve * multiplier } : undefined,
  };
}
