import type { Asset, Market, Position, ProtocolAdapter, ProtocolSnapshot, RiskParameters } from "@/core/types";
import { BlendAdapter } from "@/protocols/blend/adapter";
import { BlendApiAdapter } from "@/protocols/blend/api-adapter";
import { StellarHorizonMarketDataProvider } from "@/market-data/stellar-horizon";
import { info, warn } from "@/services/observability";

export type DataSourceMode = "demo" | "live";

/** DATA_SOURCE=live requires BLEND_API_URL; anything else stays on the deterministic fixture. */
export function dataSourceMode(): DataSourceMode {
  return process.env.DATA_SOURCE === "live" ? "live" : "demo";
}

export function dataSourceLabel(): string {
  return dataSourceMode() === "live" ? "LIVE" : "DEMO";
}

function snapshotAdapter(snapshot: ProtocolSnapshot): ProtocolAdapter {
  return {
    async getSnapshot() { return snapshot; },
    async getMarkets(): Promise<Market[]> { return snapshot.markets; },
    async getPositions(): Promise<Position[]> { return snapshot.positions; },
    async getRiskParameters(): Promise<RiskParameters> { return snapshot.risk; },
    async getCollateralAssets(): Promise<Asset[]> { return snapshot.assets; },
    async getDebtAssets(): Promise<Asset[]> { return snapshot.assets; },
  };
}

/**
 * Resolves the active Blend protocol snapshot.
 * - demo (default): deterministic hand-authored fixture.
 * - live: BlendApiAdapter (BLEND_API_URL, normalized index payload), with the
 *   live SDEX order book and constant-product XLM/USDC pools layered in when
 *   STELLAR_USDC_ISSUER is set. Throws if the live source is unconfigured or
 *   unreachable; it never falls back to invented live data.
 */
export async function resolveBlendSnapshot(): Promise<ProtocolSnapshot> {
  if (dataSourceMode() === "demo") return new BlendAdapter().getSnapshot();

  const adapter = new BlendApiAdapter();
  let snapshot = await adapter.getSnapshot();
  if (process.env.STELLAR_USDC_ISSUER) {
    const horizon = new StellarHorizonMarketDataProvider();
    try {
      const liquidity = await horizon.getLiquiditySnapshot("XLM_USDC");
      snapshot = { ...snapshot, liquidity: [liquidity] };
      info("data-source.live-ready", { snapshotId: snapshot.provenance.capturedAt, ledger: snapshot.provenance.ledger, positions: snapshot.positions.length, pools: liquidity.amms?.length ?? 0 });
    } catch (cause) {
      warn("data-source.horizon-unavailable", { error: cause instanceof Error ? cause.message : String(cause) });
    }
  }
  return snapshot;
}

export async function resolveBlendAdapter(): Promise<ProtocolAdapter> {
  return snapshotAdapter(await resolveBlendSnapshot());
}