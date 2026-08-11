import type { ProtocolSnapshot } from "@/core/types";

/**
 * Deterministic, hand-authored fixture for demos and tests. It intentionally
 * contains no claimed mainnet borrower state. Refresh this fixture only from a
 * verifiable exported snapshot when using it for a protocol-specific review.
 */
export const demoBlendSnapshot: ProtocolSnapshot = {
  protocol: "blend",
  protocolDisplayName: "Blend (reproducible demo adapter)",
  assets: [
    { id: "XLM", symbol: "XLM", decimals: 7 },
    { id: "USDC", symbol: "USDC", decimals: 7, isStable: true },
  ],
  positions: [
    [1_500_000, 460_000], [1_180_000, 390_000], [920_000, 330_000], [750_000, 200_000],
    [600_000, 180_000], [1_800_000, 490_000], [2_100_000, 580_000], [560_000, 150_000],
    [940_000, 260_000], [1_330_000, 370_000], [440_000, 100_000], [3_000_000, 840_000],
    [1_050_000, 270_000], [690_000, 180_000], [2_400_000, 620_000], [370_000, 80_000],
    [1_620_000, 440_000], [820_000, 220_000], [2_750_000, 710_000], [490_000, 130_000],
  ].map(([xlm, usdc], index) => ({
    id: `demo-blend-${String(index + 1).padStart(3, "0")}`,
    collateral: [{ assetId: "XLM", amount: xlm }],
    debt: [{ assetId: "USDC", amount: usdc }],
  })),
  risk: {
    collateralFactor: { XLM: 0.75, USDC: 0.9 },
    liquidationThreshold: { XLM: 0.85, USDC: 0.92 },
    liquidationBonus: { XLM: 0.08, USDC: 0.04 },
  },
  markets: [{
    id: "XLM_USDC",
    baseAssetId: "XLM",
    quoteAssetId: "USDC",
    spotPrice: 0.4,
    executableDepthUsd: 3_660_000,
  }],
  liquidity: [{
    marketId: "XLM_USDC",
    // USD-equivalent depth: ~$3.66m at the $0.40 reference price.
    bidLevels: [
      { price: 0.4, baseAmount: 1_500_000 },
      { price: 0.396, baseAmount: 1_800_000 },
      { price: 0.388, baseAmount: 2_100_000 },
      { price: 0.372, baseAmount: 2_400_000 },
      { price: 0.35, baseAmount: 2_600_000 },
    ],
    amms: [
      { id: "AMM:demo-blend-pool-v1", baseReserve: 3_000_000, quoteReserve: 1_200_000, feeBps: 30 },
      { id: "AMM:demo-liquidity-pool-v2", baseReserve: 1_400_000, quoteReserve: 560_000, feeBps: 45 },
    ],
    provenance: {
      kind: "DEMO",
      source: "SteBullX deterministic Blend/XLM-USDC fixture v1",
      capturedAt: "2026-08-01T00:00:00.000Z",
      note: "Demo data only. This is not a Blend or Stellar mainnet snapshot.",
    },
  }],
  provenance: {
    kind: "DEMO",
    source: "SteBullX deterministic Blend/XLM-USDC fixture v1",
    capturedAt: "2026-08-01T00:00:00.000Z",
    note: "Reproducible simulated borrower and liquidity data; never interpret as live protocol state.",
  },
};
