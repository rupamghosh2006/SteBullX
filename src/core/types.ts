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
export interface AmmPool {
  id: string;
  baseReserve: number;
  quoteReserve: number;
  feeBps: number;
}
export interface LiquiditySnapshot {
  marketId: string;
  bidLevels: OrderBookLevel[];
  amms?: AmmPool[];
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

export interface OracleScenario {
  /** How far behind the true market price the reported oracle price is (seconds). */
  delaySeconds: number;
  /** Duration of the linear oracle convergence to the shocked price (seconds). */
  rampSeconds: number;
  /** Signed bias applied to the reported price: +0.01 = reported 1% above true. */
  divergence: number;
  /** > 0: the oracle stops updating after this many seconds and reports its last value. */
  staleAfterSeconds: number;
  /** True: the oracle is frozen at the pre-shock price for the whole simulation. */
  failure: boolean;
}

export interface StressScenario {
  id?: string;
  name: string;
  assetPriceShocks: Record<string, number>;
  liquidityShocks: Record<string, number>;
  /** @deprecated Use oracle.delaySeconds. Kept for UI/config back-compat. */
  oracleDelaySeconds?: number;
  oracle: OracleScenario;
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

export interface ExecutionVenue {
  venueId: string;
  venueKind: "ORDER_BOOK" | "AMM";
  baseAmount: number;
  quoteUsd: number;
  averagePrice: number;
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
  venues: ExecutionVenue[];
}

export interface CascadeIteration {
  iteration: number;
  elapsedSeconds: number;
  newlyLiquidatable: number;
  totalLiquidatable: number;
  collateralSoldXlm: number;
  recoveredUsd: number;
  estimatedBadDebtUsd: number;
  marketPriceUsd: number;
  oraclePriceUsd: number;
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

export interface DataQualityAssessment {
  /** 0–100 confidence in input/model suitability, not the probability that a result is true. */
  confidenceScore: number;
  level: "LOW" | "MODERATE" | "HIGH";
  components: {
    dataFreshness: number;
    dataCompleteness: number;
    sourceCoverage: number;
    adapterReliability: number;
    modelCalibration: number;
  };
  warnings: string[];
}

export interface SimulationAudit {
  deterministicId: string;
  inputHash: string;
  scenarioHash: string;
  resultHash: string;
  sourceLedger?: number;
  modelVersion: string;
}

export interface HistoricalEpisode {
  id: string;
  protocol: "blend";
  marketId: string;
  title: string;
  startLedger: number;
  endLedger: number;
  startedAt: string;
  startSnapshot: ProtocolSnapshot;
  /** Observed market movement over the episode, ledger-pinned. */
  marketPath: { ledger: number; xlmUsd: number }[];
  /** Explicit replay assumptions archived with the episode. */
  assumed: {
    liquidityShock: number;
    oracle: OracleScenario;
    maxCascadeIterations: number;
    maxSlippage: number;
  };
  /** Archived observed outcome, for model-error tracking. */
  observed: {
    liquidationVolumeUsd: number;
    badDebtUsd: number;
    priceImpactPct: number;
    cascadeDepth: number;
    affectedPositions: number;
  };
  note: string;
}

export interface ReplayPrediction {
  liquidationVolumeUsd: number;
  badDebtUsd: number;
  priceImpactPct: number;
  cascadeDepth: number;
  affectedPositions: number;
}

export interface HistoricalReplayResult {
  id: string;
  episodeId: string;
  protocol: string;
  marketId: string;
  startLedger: number;
  endLedger: number;
  startedAt: string;
  generatedAt: string;
  modelVersion: string;
  predicted: ReplayPrediction;
  observed: HistoricalEpisode["observed"];
  errors: {
    liquidationVolumeErrorPct: number;
    badDebtErrorPct: number;
    priceImpactDeltaPct: number;
    cascadeDepthDelta: number;
    affectedPositionsDelta: number;
  };
  scenario: StressScenario;
  cascade: CascadeIteration[];
  inputHash: string;
  warnings: string[];
}

export interface StressTestResult { id: string;
  protocol: string;
  market: string;
  scenario: StressScenario;
  data: DataProvenance;
  generatedAt: string;
  oracle: OracleScenario;
  summary: {
    totalPositions: number;
    affectedPositions: number;
    liquidatablePositions: number;
    liquidationExposureUsd: number;
    liquidationDemandUsd: number;
    liquidatableCollateralUsd: number;
    estimatedRecoverableValueUsd: number;
    potentialBadDebtUsd: number;
    stressLossUsd: number;
    normalLiquidityUsd: number;
    stressedLiquidityUsd: number;
    liquidationCapacityUsd: number;
    cascadeDepth: number;
  };
  risk: RiskBreakdown;
  dataQuality: DataQualityAssessment;
  audit: SimulationAudit;
  positions: RevaluedPosition[];
  executionCurve: ExecutionEstimate[];
  cascade: CascadeIteration[];
  assumptions: string[];
  methodologyVersion: string;
}
