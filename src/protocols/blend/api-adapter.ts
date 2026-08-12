import type { Asset, DataProvenance, Market, Position, ProtocolAdapter, ProtocolSnapshot, RiskParameters } from "@/core/types";

/**
 * Normalized payload contract for a Blend index/snapshot source. Blend does not
 * expose a public REST API for borrower positions today: positions live in the
 * Soroban pool contract (`get_positions(address)`) and enumerating users
 * requires an event indexer (PoolEvents: Deposit/Withdraw/Borrow/Repay/
 * FillLiquidation...). Point BLEND_API_URL at any service that produces this
 * shape, e.g. an indexer built from @blend-capital/blend-sdk reads.
 *
 * {
 *   "capturedAt": "2026-08-12T10:00:00.000Z",
 *   "ledger": 12842192,                       // optional, ledger sequence
 *   "source": "https://indexer.example/blend",// optional, overrides provenance source
 *   "assets":     [{ "id": "XLM", "symbol": "XLM", "decimals": 7 }],
 *   "risk": {
 *     "collateralFactor":     { "XLM": 0.9 },
 *     "liquidationThreshold": { "XLM": 0.85 },
 *     "liquidationBonus":     { "XLM": 0.05 }
 *   },
 *   "positions": [
 *     { "id": "G...", "collateral": [{ "assetId": "XLM", "amount": 12345.67 }],
 *       "debt": [{ "assetId": "USDC", "amount": 10 }], "openedAt": "2026-01-01T00:00:00Z" }
 *   ],
 *   "markets": [
 *     { "id": "XLM_USDC", "baseAssetId": "XLM", "quoteAssetId": "USDC",
 *       "spotPrice": 0.4, "executableDepthUsd": 123456 }
 *   ]
 * }
 */

export interface BlendSnapshotPayload {
  capturedAt: string;
  ledger?: number;
  source?: string;
  assets: Asset[];
  risk: RiskParameters;
  positions: Position[];
  markets: Market[];
}

function assertShape(configuration: Record<string, unknown>, name: string) {
  if (typeof configuration !== "object" || configuration === null) throw new Error(`Blend index payload is missing "${name}".`);
}

function finiteNonNegative(value: unknown, path: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Blend index payload has an invalid number at ${path}.`);
}

function parseNumber(value: unknown, path: string): number {
  finiteNonNegative(value, path);
  return value as number;
}

/** Pure parse + validation, exported for tests. Never returns malformed shapes. */
export function parseBlendSnapshotPayload(payload: unknown, source: string): ProtocolSnapshot {
  if (typeof payload !== "object" || payload === null) throw new Error("Blend index payload must be a JSON object.");
  const raw = payload as Partial<BlendSnapshotPayload>;
  if (typeof raw.capturedAt !== "string" || Number.isNaN(Date.parse(raw.capturedAt))) throw new Error("Blend index payload.capturedAt must be an ISO timestamp.");
  const assets = (raw.assets ?? []).map((asset, index) => {
    if (!asset || typeof asset.id !== "string" || typeof asset.symbol !== "string") throw new Error(`Blend index payload.assets[${index}] must have string id and symbol.`);
    finiteNonNegative(asset.decimals, `assets[${index}].decimals`);
    return { id: asset.id, symbol: asset.symbol, decimals: asset.decimals, isStable: asset.isStable === true };
  });
  const assetIds = new Set(assets.map((asset) => asset.id));
  const positions = (raw.positions ?? []).map((position, index) => {
    if (!position || typeof position.id !== "string") throw new Error(`Blend index payload.positions[${index}] must have a string id.`);
    const collateral = (position.collateral ?? []).map((amount, i) => {
      if (!amount || typeof amount.assetId !== "string" || !assetIds.has(amount.assetId)) throw new Error(`Blend index payload.positions[${index}].collateral[${i}] references an unknown asset.`);
      return { assetId: amount.assetId, amount: parseNumber(amount.amount, `positions[${index}].collateral[${i}].amount`) };
    });
    const debt = (position.debt ?? []).map((amount, i) => {
      if (!amount || typeof amount.assetId !== "string" || !assetIds.has(amount.assetId)) throw new Error(`Blend index payload.positions[${index}].debt[${i}] references an unknown asset.`);
      return { assetId: amount.assetId, amount: parseNumber(amount.amount, `positions[${index}].debt[${i}].amount`) };
    });
    return { id: position.id, collateral, debt, openedAt: position.openedAt };
  });
  const positionIds = new Set(positions.map((position) => position.id));
  if (positionIds.size !== positions.length) throw new Error("Blend index payload.positions ids must be unique.");
  const risk = raw.risk;
  if (!risk) throw new Error('Blend index payload.risk is required (collateralFactor, liquidationThreshold, liquidationBonus).');
  const riskParameters: RiskParameters = {
    collateralFactor: {},
    liquidationThreshold: {},
    liquidationBonus: {},
  };
  const fill = (map: Record<string, unknown> | undefined, name: string, target: Record<string, number>) => {
    for (const [assetId, value] of Object.entries(map ?? {})) target[assetId] = parseNumber(value, `risk.${name}.${assetId}`);
  };
  fill(risk.collateralFactor, "collateralFactor", riskParameters.collateralFactor);
  fill(risk.liquidationThreshold, "liquidationThreshold", riskParameters.liquidationThreshold);
  fill(risk.liquidationBonus, "liquidationBonus", riskParameters.liquidationBonus);
  const markets = (raw.markets ?? []).map((market, index) => {
    if (!market || typeof market.id !== "string") throw new Error(`Blend index payload.markets[${index}] must have a string id.`);
    return {
      id: market.id,
      baseAssetId: market.baseAssetId,
      quoteAssetId: market.quoteAssetId,
      spotPrice: parseNumber(market.spotPrice, `markets[${index}].spotPrice`),
      executableDepthUsd: parseNumber(market.executableDepthUsd, `markets[${index}].executableDepthUsd`),
    };
  });
  const provenance: DataProvenance = {
    kind: "INDEXED",
    source: raw.source ?? source,
    capturedAt: raw.capturedAt,
    ledger: raw.ledger,
    note: "Normalized Blend index snapshot; labelled INDEXED unless the source is a direct chain read.",
  };
  return {
    protocol: "blend",
    protocolDisplayName: "Blend",
    assets,
    positions,
    risk: riskParameters,
    markets,
    liquidity: [],
    provenance,
  };
}

/**
 * Live Blend adapter. Reads the normalized payload contract above from
 * BLEND_API_URL and throws rather than silently substituting demo values.
 * Liquidity (order book + constant-product pools) is layered on by the
 * resolver when STELLAR_USDC_ISSUER is configured.
 */
export class BlendApiAdapter implements ProtocolAdapter {
  private readonly endpoint = process.env.BLEND_API_URL;

  private assertConfigured() {
    if (!this.endpoint) throw new Error('Live Blend data unavailable: BLEND_API_URL is not configured. See docs/LIVE_BLEND_ADAPTER.md for the index payload contract.');
  }

  async getSnapshot(): Promise<ProtocolSnapshot> {
    this.assertConfigured();
    const response = await fetch(this.endpoint!, { cache: "no-store" });
    if (!response.ok) throw new Error(`Blend index request failed (${response.status}).`);
    const payload: unknown = await response.json();
    return parseBlendSnapshotPayload(payload, this.endpoint!);
  }

  async getMarkets(): Promise<Market[]> { return (await this.getSnapshot()).markets; }
  async getPositions(): Promise<Position[]> { return (await this.getSnapshot()).positions; }
  async getRiskParameters(): Promise<RiskParameters> { return (await this.getSnapshot()).risk; }
  async getCollateralAssets(): Promise<Asset[]> { return (await this.getSnapshot()).assets; }
  async getDebtAssets(): Promise<Asset[]> { return (await this.getSnapshot()).assets; }
}