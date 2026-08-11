import type { DataProvenance, LiquiditySnapshot, MarketDataProvider } from "@/core/types";

type HorizonBook = { bids?: Array<{ price: string; amount: string }> };

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
}
