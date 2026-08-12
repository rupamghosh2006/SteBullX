import { afterEach, describe, expect, it, vi } from "vitest";
import { parseBlendSnapshotPayload, BlendApiAdapter } from "@/protocols/blend/api-adapter";
import { StellarHorizonMarketDataProvider } from "@/market-data/stellar-horizon";
import { observeBetween } from "@/services/archiver";
import type { ProtocolSnapshot } from "@/core/types";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const validPayload = {
  capturedAt: "2026-08-12T10:00:00.000Z",
  ledger: 12_842_192,
  source: "https://indexer.example/blend",
  assets: [{ id: "XLM", symbol: "XLM", decimals: 7 }, { id: "USDC", symbol: "USDC", decimals: 7, isStable: true }],
  risk: { collateralFactor: { XLM: 0.9, USDC: 0.8 }, liquidationThreshold: { XLM: 0.85, USDC: 0.8 }, liquidationBonus: { XLM: 0.05, USDC: 0 } },
  positions: [
    { id: "GAAA", collateral: [{ assetId: "XLM", amount: 12_345.67 }], debt: [{ assetId: "USDC", amount: 100.5 }], openedAt: "2026-01-01T00:00:00Z" },
    { id: "GBBB", collateral: [{ assetId: "XLM", amount: 500 }], debt: [] },
  ],
  markets: [{ id: "XLM_USDC", baseAssetId: "XLM", quoteAssetId: "USDC", spotPrice: 0.4, executableDepthUsd: 250_000 }],
};

describe("Blend index payload parsing", () => {
  it("maps a valid payload to a ProtocolSnapshot with INDEXED provenance", () => {
    const snapshot = parseBlendSnapshotPayload(validPayload, "https://configured.example");
    expect(snapshot.protocol).toBe("blend");
    expect(snapshot.positions).toHaveLength(2);
    expect(snapshot.positions[0].collateral[0].amount).toBeCloseTo(12_345.67, 8);
    expect(snapshot.risk.liquidationThreshold.XLM).toBe(0.85);
    expect(snapshot.markets[0].spotPrice).toBe(0.4);
    expect(snapshot.provenance.kind).toBe("INDEXED");
    expect(snapshot.provenance.source).toBe("https://indexer.example/blend");
    expect(snapshot.provenance.ledger).toBe(12_842_192);
  });

  it("throws on a missing capturedAt", () => {
    const { capturedAt: _omitted, ...bad } = validPayload;
    expect(() => parseBlendSnapshotPayload(bad, "source")).toThrow(/capturedAt/);
  });

  it("throws on an unknown asset reference in a position", () => {
    const bad = structuredClone(validPayload) as typeof validPayload;
    (bad.positions[0].collateral[0] as { assetId: string }).assetId = "EURC";
    expect(() => parseBlendSnapshotPayload(bad, "source")).toThrow(/unknown asset/);
  });

  it("throws on duplicate position ids", () => {
    const bad = structuredClone(validPayload) as typeof validPayload;
    bad.positions[1].id = "GAAA";
    expect(() => parseBlendSnapshotPayload(bad, "source")).toThrow(/unique/);
  });

  it("throws on negative amounts", () => {
    const bad = structuredClone(validPayload) as typeof validPayload;
    bad.positions[0].collateral[0].amount = -1;
    expect(() => parseBlendSnapshotPayload(bad, "source")).toThrow(/invalid number/);
  });

  it("throws when the adapter is unconfigured", async () => {
    vi.stubEnv("BLEND_API_URL", "");
    await expect(new BlendApiAdapter().getSnapshot()).rejects.toThrow(/BLEND_API_URL/);
  });
});

describe("Horizon constant-product pool reads", () => {
  const page = {
    _links: { next: { href: "/liquidity_pools?limit=200&order=desc&cursor=abc" } },
    _embedded: {
      records: [
        {
          id: "pool-xlm-usdc",
          type: "constant_product",
          fee_bp: 30,
          last_modified_ledger: "12842192",
          reserves: [{ asset: "native", amount: "50000.0000000" }, { asset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", amount: "20000.0000000" }],
        },
        {
          id: "pool-eurt-usdc",
          type: "constant_product",
          fee_bp: 30,
          last_modified_ledger: "12842000",
          reserves: [{ asset: "EURT:GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S", amount: "1000" }, { asset: "USDC:GAP5LETOV6YIE62YAM56STDANPRDO7ZFDBGSNHJQIYGGKSMOZAHOOS2S", amount: "1000" }],
        },
        { id: "pool-stable", type: "stable", fee_bp: 10, last_modified_ledger: "1", reserves: [{ asset: "native", amount: "1" }, { asset: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN", amount: "1" }] },
      ],
    },
  };

  it("selects only constant-product native-XLM/USDC pools", async () => {
    vi.stubEnv("STELLAR_USDC_ISSUER", "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");
    vi.stubEnv("STELLAR_HORIZON_URL", "https://horizon.test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => page }));
    const provider = new StellarHorizonMarketDataProvider();
    const pools = await provider.getPools("XLM_USDC", 2);
    expect(pools).toHaveLength(1);
    expect(pools[0].id).toBe("pool-xlm-usdc");
    expect(pools[0].baseReserve).toBe(50_000);
    expect(pools[0].quoteReserve).toBe(20_000);
    expect(pools[0].feeBps).toBe(30);
  });

  it("throws when STELLAR_USDC_ISSUER is not configured", async () => {
    vi.stubEnv("STELLAR_USDC_ISSUER", "");
    await expect(new StellarHorizonMarketDataProvider().getPools("XLM_USDC")).rejects.toThrow(/STELLAR_USDC_ISSUER/);
  });
});

describe("archive observer", () => {
  function snapshotWith(spotPrice: number, positions: ProtocolSnapshot["positions"], liquidity?: ProtocolSnapshot["liquidity"]): ProtocolSnapshot {
    return {
      ...structuredClone(validPayload),
      positions,
      markets: [{ id: "XLM_USDC", baseAssetId: "XLM", quoteAssetId: "USDC", spotPrice, executableDepthUsd: 250_000 }],
      liquidity: liquidity ?? [{ marketId: "XLM_USDC", bidLevels: [{ price: spotPrice, baseAmount: 200_000 }], provenance: { kind: "INDEXED", source: "test", capturedAt: "2026-08-12T10:00:00.000Z" } }],
    } as unknown as ProtocolSnapshot;
  }

  it("derives observed liquidation volume from the revalued start snapshot", () => {
    const prevSnapshot = snapshotWith(0.4, [
      { id: "GAAA", collateral: [{ assetId: "XLM", amount: 1_000 }], debt: [{ assetId: "USDC", amount: 300 }] },
      { id: "GBBB", collateral: [{ assetId: "XLM", amount: 1_000 }], debt: [{ assetId: "USDC", amount: 100 }] },
    ]);
    const nextSnapshot = snapshotWith(0.28, prevSnapshot.positions.map((p) => ({ ...p, collateral: p.collateral.map((c) => ({ ...c, amount: c.amount * 0.98 })) })));
    const observed = observeBetween(prevSnapshot, nextSnapshot);
    // GAAA: 1000 XLM × $0.28 × 0.85 = $238 vs $300 debt → HF 0.79 → liquidatable.
    // GBBB: $238 vs $100 → healthy. One affected, positive volume, price impact = (0.4 - 0.28) / 0.4.
    expect(observed.affectedPositions).toBe(1);
    expect(observed.liquidationVolumeUsd).toBeGreaterThan(0);
    expect(observed.priceImpactPct).toBeCloseTo((0.4 - 0.28) / 0.4, 8);
  });

  it("reports zero observed activity when prices do not move", () => {
    const prevSnapshot = snapshotWith(0.4, [{ id: "GAAA", collateral: [{ assetId: "XLM", amount: 1_000 }], debt: [{ assetId: "USDC", amount: 300 }] }]);
    const observed = observeBetween(prevSnapshot, snapshotWith(0.4, prevSnapshot.positions));
    expect(observed.liquidationVolumeUsd).toBe(0);
    expect(observed.cascadeDepth).toBe(0);
  });
});

describe("archive capture", () => {
  it("captures a live snapshot as an indexed archived episode", async () => {
    vi.resetModules();
    vi.stubEnv("DATA_SOURCE", "live");
    vi.stubEnv("BLEND_API_URL", "https://indexer.example/blend");
    vi.stubEnv("STELLAR_USDC_ISSUER", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("STEBULLX_ARCHIVE_FILE", `data/test-archive-${Date.now()}.json`);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => validPayload }));
    const { captureEpisode } = await import("@/services/archiver");
    const { listArchivedEpisodes } = await import("@/services/archive-store");
    const episode = await captureEpisode();
    expect(episode.id).toBe("archive-12842192");
    expect(episode.startSnapshot.provenance.kind).toBe("INDEXED");
    expect(episode.observed.liquidationVolumeUsd).toBe(0);
    expect(episode.note).toMatch(/CAPTURED ARCHIVE/);
    const listed = await listArchivedEpisodes();
    expect(listed.some((item) => item.id === episode.id)).toBe(true);
  });
});