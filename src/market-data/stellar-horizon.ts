import type { AmmPool, DataProvenance, LiquiditySnapshot, MarketDataProvider } from "@/core/types";

type HorizonBook = { bids?: Array<{ price: string; amount: string }> };
type HorizonPoolRecord = {
  id: string;
  type: "constant_product" | "stable";
  fee_bp: number;
  reserves: Array<{ asset: string; amount: string }>;
  last_modified_ledger: string;
};
type HorizonPoolPage = { _links: { next?: { href: string } }; _embedded: { records: HorizonPoolRecord[] } };

const MAX_POOL_PAGES = 5;

function resolveHref(base: string, href: string): string {
  try { return new URL(href, base).toString(); } catch { return href; }
}

/**
 * Optional live SDEX provider. It needs a verified USDC issuer in environment
 * configuration and throws rather than silently substituting demo values.
 */
export class StellarHorizonMarketDataProvider implements MarketDataProvider {
  private readonly endpoint = process.env.STELLAR_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
  private readonly usdcIssuer = process.env.STELLAR_USDC_ISSUER;

  private assertConfigured() {
    if (!this.usdcIssuer) throw new Error("Live SDEX data unavailable: STELLAR_USDC_ISSUER is not configured from a verified source.");
  }

  async getOrderBook(marketId: string): Promise<LiquiditySnapshot> {
    if (marketId !== "XLM_USDC") throw new Error(`Unsupported live market: ${marketId}`);
    this.assertConfigured();
    const params = new URLSearchParams({
      buying_asset_type: "credit_alphanum4",
      buying_asset_code: "USDC",
      buying_asset_issuer: this.usdcIssuer!,
      selling_asset_type: "native",
      limit: "200",
    });
    const response = await fetch(`${this.endpoint}/order_book?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Horizon order book request failed (${response.status}).`);
    const book = await response.json() as HorizonBook;
    const capturedAt = new Date().toISOString();
    const provenance: DataProvenance = { kind: "LIVE", source: `${this.endpoint}/order_book`, capturedAt, note: "SDEX order-book snapshot; exclude venues not represented here." };
    return {
      marketId,
      bidLevels: (book.bids ?? []).map((bid) => ({ price: Number(bid.price), baseAmount: Number(bid.amount) })),
      provenance,
    };
  }

  async getSpotPrice(assetId: string) {
    const book = await this.getOrderBook(assetId === "XLM" ? "XLM_USDC" : assetId);
    const price = book.bidLevels[0]?.price;
    if (!price) throw new Error("Live SDEX order book is empty.");
    return { price, provenance: book.provenance };
  }

  async getLiquidity(marketId: string) {
    const book = await this.getOrderBook(marketId);
    return { executableDepthUsd: book.bidLevels.reduce((total, level) => total + level.price * level.baseAmount, 0), provenance: book.provenance };
  }

  private isNative(asset: string) {
    return asset === "native" || asset.startsWith("XLM:");
  }

  private isUsdc(asset: string) {
    return asset === `USDC:${this.usdcIssuer}`;
  }

  /**
   * Constant-product pools holding exactly {native XLM, USDC:<issuer>}. The
   * Horizon record's canonical asset form is `Code:Issuer`; native XLM appears
   * as `native`. Client-side filtering keeps the mapping correct regardless of
   * the reserved filter-string format, at the cost of paginating recent pools.
   */
  async getPools(marketId: string, maxPages = MAX_POOL_PAGES): Promise<AmmPool[]> {
    if (marketId !== "XLM_USDC") throw new Error(`Unsupported live market: ${marketId}`);
    this.assertConfigured();
    const capturedAt = new Date().toISOString();
    const pools: AmmPool[] = [];
    const seen = new Set<string>();
    let url: string | undefined = `${this.endpoint}/liquidity_pools?limit=200&order=desc`;
    for (let page = 0; page < maxPages && url; page += 1) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Horizon liquidity pools request failed (${response.status}).`);
      const payload = await response.json() as HorizonPoolPage;
      for (const record of payload._embedded.records) {
        if (record.type !== "constant_product" || seen.has(record.id)) continue;
        const xlm = record.reserves.find((reserve) => this.isNative(reserve.asset));
        const usdc = record.reserves.find((reserve) => this.isUsdc(reserve.asset));
        if (!xlm || !usdc || record.reserves.length !== 2) continue;
        seen.add(record.id);
        pools.push({
          id: record.id,
          baseReserve: Number(xlm.amount),
          quoteReserve: Number(usdc.amount),
          feeBps: record.fee_bp,
        });
      }
      url = payload._links.next?.href ? resolveHref(this.endpoint, payload._links.next.href) : undefined;
    }
    return pools;
  }

  async getLiquiditySnapshot(marketId: string): Promise<LiquiditySnapshot> {
    const book = await this.getOrderBook(marketId);
    const amms = await this.getPools(marketId);
    return {
      marketId,
      bidLevels: book.bidLevels,
      amms,
      provenance: {
        kind: "LIVE",
        source: `${this.endpoint}/order_book + /liquidity_pools`,
        capturedAt: new Date().toISOString(),
        note: "SDEX order-book snapshot plus constant-product XLM/USDC pools; exclude venues not represented here.",
      },
    };
  }
}
