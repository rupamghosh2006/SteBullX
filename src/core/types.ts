export type DataKind = "LIVE" | "INDEXED" | "CACHED" | "HISTORICAL" | "DEMO" | "SIMULATED";
export type PositionClassification = "HEALTHY" | "AT_RISK" | "LIQUIDATABLE" | "SEVERELY_UNDERCOLLATERALIZED";
export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export interface DataProvenance {
  kind: DataKind;
  source: string;
  capturedAt: string;
  ledger?: number;
  note?: string;
}

export interface Asset {
  id: string;
  symbol: string;
  decimals: number;
  isStable?: boolean;
}

export interface Amount { assetId: string; amount: number; }

export interface RiskParameters {
  collateralFactor: Record<string, number>;
  liquidationThreshold: Record<string, number>;
  liquidationBonus: Record<string, number>;
}

export interface Position {
  id: string;
  collateral: Amount[];
  debt: Amount[];
  openedAt?: string;
}

export interface Market {
  id: string;
  baseAssetId: string;
  quoteAssetId: string;
  spotPrice: number;
  /** Amount of base asset, quoted in USD, available in the modeled executable book. */
  executableDepthUsd: number;
}

export interface OrderBookLevel { price: number; baseAmount: number; }
export interface LiquiditySnapshot {
  marketId: string;
  bidLevels: OrderBookLevel[];
  amm?: { baseReserve: number; quoteReserve: number; feeBps: number };
  provenance: DataProvenance;
}

export interface ProtocolSnapshot {
  protocol: "blend";
  protocolDisplayName: string;
  assets: Asset[];
  positions: Position[];
  risk: RiskParameters;
  markets: Market[];
  liquidity: LiquiditySnapshot[];
  provenance: DataProvenance;
}

export interface ProtocolAdapter {
  getMarkets(): Promise<Market[]>;
  getPositions(): Promise<Position[]>;
  getRiskParameters(): Promise<RiskParameters>;
  getCollateralAssets(): Promise<Asset[]>;
  getDebtAssets(): Promise<Asset[]>;
  getSnapshot(): Promise<ProtocolSnapshot>;
}

export interface MarketDataProvider {
  getSpotPrice(assetId: string): Promise<{ price: number; provenance: DataProvenance }>;
  getOrderBook(marketId: string): Promise<LiquiditySnapshot>;
  getLiquidity(marketId: string): Promise<{ executableDepthUsd: number; provenance: DataProvenance }>;
  getHistoricalPrices?(assetId: string, period: string): Promise<number[]>;
}

export interface StressScenario {
  id?: string;
  name: string;
  assetPriceShocks: Record<string, number>;
  liquidityShocks: Record<string, number>;
  oracleDelaySeconds: number;
  maxCascadeIterations: number;
  maxSlippage: number;
}

export interface RevaluedPosition extends Position {
  collateralValueUsd: number;
  debtValueUsd: number;
  healthFactor: number;
  loanToValue: number;
  liquidationThreshold: number;
  classification: PositionClassification;
}

export interface ExecutionEstimate {
  requestedBaseAmount: number;
  executedBaseAmount: number;
  recoveredUsd: number;
  averageExecutionPrice: number;
  referencePrice: number;
  priceImpact: number;
  slippage: number;
  unexecutedBaseAmount: number;
}

export interface CascadeIteration {
  iteration: number;
  newlyLiquidatable: number;
  totalLiquidatable: number;
  collateralSoldXlm: number;
  recoveredUsd: number;
  estimatedBadDebtUsd: number;
  marketPriceUsd: number;
  priceImpact: number;
  remainingDepthUsd: number;
}

export interface RiskBreakdown {
  liquidationExposure: number;
  liquidityCoverage: number;
  slippageRisk: number;
  cascadeRisk: number;
  badDebtRisk: number;
  score: number;
  level: RiskLevel;
}

export interface StressTestResult {
  id: string;
  protocol: string;
  market: string;
  scenario: StressScenario;
  data: DataProvenance;
  generatedAt: string;
  summary: {
    totalPositions: number;
    affectedPositions: number;
    liquidatablePositions: number;
    liquidatableCollateralUsd: number;
    estimatedRecoverableValueUsd: number;
    potentialBadDebtUsd: number;
    normalLiquidityUsd: number;
    stressedLiquidityUsd: number;
    liquidationCapacityUsd: number;
    cascadeDepth: number;
  };
  risk: RiskBreakdown;
  positions: RevaluedPosition[];
  executionCurve: ExecutionEstimate[];
  cascade: CascadeIteration[];
  assumptions: string[];
  methodologyVersion: string;
}
