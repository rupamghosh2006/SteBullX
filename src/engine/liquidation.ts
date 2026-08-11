import { clamp, sum } from "@/core/math";
import type { AmmPool, ExecutionEstimate, ExecutionVenue, LiquiditySnapshot, OrderBookLevel } from "@/core/types";

export interface ExecutionLiquidityState {
  bidLevels: OrderBookLevel[];
  amms: AmmPool[];
}

/** A pool never accepts unlimited quote: executable participation is capped (documented assumption). */
export const POOL_EXECUTION_CAP = 0.75;

export function stressedLiquidity(snapshot: LiquiditySnapshot, liquidityShock: number, priceMultiplier: number): ExecutionLiquidityState {
  const factor = clamp(1 + liquidityShock, 0.01, 1);
  return {
    bidLevels: snapshot.bidLevels.map((level) => ({ price: level.price * priceMultiplier, baseAmount: level.baseAmount * factor })),
    amms: (snapshot.amms ?? []).map((pool) => ({
      ...pool,
      baseReserve: pool.baseReserve * factor,
      quoteReserve: pool.quoteReserve * factor * priceMultiplier,
    })),
  };
}

export function liquidityValue(state: ExecutionLiquidityState): number {
  const book = sum(state.bidLevels.map((level) => level.baseAmount * level.price));
  // Quote reserve is an upper bound; executable participation is capped per pool.
  return book + sum(state.amms.map((pool) => pool.quoteReserve * POOL_EXECUTION_CAP));
}

export function poolTouchPrice(pool: AmmPool): number {
  if (pool.baseReserve <= 0 || pool.quoteReserve <= 0) return 0;
  return (1 - pool.feeBps / 10_000) * pool.quoteReserve / pool.baseReserve;
}

interface PoolState extends AmmPool {
  initialQuoteReserve: number;
  spentQuote: number;
}

/**
 * Sell `remaining` base into a single pool, stopping once the pool's marginal
 * price falls to `floorPrice` (the next-best venue), the participation cap is
 * reached, or the request is filled. Returns base filled and quote received.
 */
function fillPool(state: PoolState, remaining: number, floorPrice: number): { filled: number; quoteOut: number } {
  if (remaining <= 1e-9 || state.baseReserve <= 0 || state.quoteReserve <= 0) return { filled: 0, quoteOut: 0 };
  const fee = state.feeBps / 10_000;
  const k = state.baseReserve * state.quoteReserve;
  const quoteCap = state.initialQuoteReserve * POOL_EXECUTION_CAP - state.spentQuote;
  if (quoteCap <= 0) return { filled: 0, quoteOut: 0 };

  let delta = remaining;
  if (floorPrice > 0) {
    // Marginal price after selling de: (1-f)*k/(x+de)^2 = floorPrice.
    const targetInput = Math.sqrt((1 - fee) * k / floorPrice) - state.baseReserve;
    if (targetInput <= 0) return { filled: 0, quoteOut: 0 };
    delta = Math.min(delta, targetInput / (1 - fee));
  }

  const fullQuoteOut = Math.max(0, state.quoteReserve - k / (state.baseReserve + delta * (1 - fee)));
  if (fullQuoteOut > quoteCap) {
    const cappedInput = (k / (state.quoteReserve - quoteCap) - state.baseReserve) / (1 - fee);
    return { filled: Math.max(0, cappedInput), quoteOut: quoteCap };
  }
  return { filled: delta, quoteOut: fullQuoteOut };
}

export function executeCollateralSale(state: ExecutionLiquidityState, requestedBaseAmount: number, referencePrice: number): { estimate: ExecutionEstimate; remaining: ExecutionLiquidityState } {
  let remainingToSell = Math.max(0, requestedBaseAmount);
  let executed = 0;
  let recovered = 0;
  const venues: ExecutionVenue[] = [];
  const remainingLevels: OrderBookLevel[] = state.bidLevels.map((level) => ({ ...level }));
  const pools: PoolState[] = state.amms.map((pool) => ({ ...pool, initialQuoteReserve: pool.quoteReserve, spentQuote: 0 }));

  const record = (venueId: string, venueKind: "ORDER_BOOK" | "AMM", baseAmount: number, quoteUsd: number) => {
    if (baseAmount <= 1e-9) return;
    executed += baseAmount;
    recovered += quoteUsd;
    const existing = venues.find((item) => item.venueId === venueId);
    if (existing) {
      existing.baseAmount += baseAmount;
      existing.quoteUsd += quoteUsd;
      existing.averagePrice = existing.quoteUsd / existing.baseAmount;
    } else {
      venues.push({ venueId, venueKind, baseAmount, quoteUsd, averagePrice: quoteUsd / baseAmount });
    }
  };

  while (remainingToSell > 1e-9) {
    const nextBid = remainingLevels.find((level) => level.baseAmount > 1e-9);
    const bestPool = pools.reduce<PoolState | undefined>((best, pool) => {
      if (pool.spentQuote >= pool.initialQuoteReserve * POOL_EXECUTION_CAP) return best;
      if (!best || poolTouchPrice(pool) > poolTouchPrice(best)) return pool;
      return best;
    }, undefined);
    if (!nextBid && !bestPool) break;

    const bidPrice = nextBid?.price ?? 0;
    const poolPrice = bestPool ? poolTouchPrice(bestPool) : 0;

    if (nextBid && (!bestPool || bidPrice >= poolPrice)) {
      const fill = Math.min(nextBid.baseAmount, remainingToSell);
      record("SDEX", "ORDER_BOOK", fill, fill * nextBid.price);
      remainingToSell -= fill;
      nextBid.baseAmount -= fill;
    } else if (bestPool) {
      const floor = nextBid ? bidPrice : 0;
      const { filled, quoteOut } = fillPool(bestPool, remainingToSell, floor);
      if (filled <= 1e-9 || quoteOut <= 1e-9) {
        bestPool.spentQuote = bestPool.initialQuoteReserve * POOL_EXECUTION_CAP;
        continue;
      }
      record(bestPool.id, "AMM", filled, quoteOut);
      remainingToSell -= filled;
      const fee = bestPool.feeBps / 10_000;
      bestPool.baseReserve = bestPool.baseReserve + filled * (1 - fee);
      bestPool.quoteReserve = Math.max(0, bestPool.quoteReserve - quoteOut);
      bestPool.spentQuote += quoteOut;
    } else {
      break;
    }
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
      venues,
    },
    remaining: { bidLevels: remainingLevels.filter((level) => level.baseAmount > 1e-9), amms: pools.map(({ initialQuoteReserve: _ignored, ...pool }) => pool) },
  };
}

/** Reprices residual venue quotes after a completed liquidation round. */
export function applyMarketImpact(state: ExecutionLiquidityState, priceImpact: number): ExecutionLiquidityState {
  const multiplier = 1 - clamp(priceImpact * 0.45, 0, 0.35);
  return {
    bidLevels: state.bidLevels.map((level) => ({ ...level, price: level.price * multiplier })),
    amms: state.amms.map((pool) => ({ ...pool, quoteReserve: pool.quoteReserve * multiplier })),
  };
}
