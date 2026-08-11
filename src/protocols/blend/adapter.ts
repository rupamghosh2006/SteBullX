import { demoBlendSnapshot } from "@/data/demo-blend-snapshot";
import type { Asset, Market, Position, ProtocolAdapter, ProtocolSnapshot, RiskParameters } from "@/core/types";

/**
 * The MVP adapter deliberately defaults to a reproducible fixture. A production
 * Blend indexer should implement the same contract, attach its ledger sequence,
 * and only then be exposed as LIVE or INDEXED in the API.
 */
export class BlendAdapter implements ProtocolAdapter {
  async getSnapshot(): Promise<ProtocolSnapshot> { return structuredClone(demoBlendSnapshot); }
  async getMarkets(): Promise<Market[]> { return (await this.getSnapshot()).markets; }
  async getPositions(): Promise<Position[]> { return (await this.getSnapshot()).positions; }
  async getRiskParameters(): Promise<RiskParameters> { return (await this.getSnapshot()).risk; }
  async getCollateralAssets(): Promise<Asset[]> { return (await this.getSnapshot()).assets; }
  async getDebtAssets(): Promise<Asset[]> { return (await this.getSnapshot()).assets; }
}
