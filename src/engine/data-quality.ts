import { round } from "@/core/math";
import type { DataQualityAssessment, ProtocolSnapshot } from "@/core/types";

/**
 * Input suitability is reported separately from risk. Scores are a documented
 * weighted assessment, never a prediction-confidence claim.
 */
export function assessDataQuality(snapshot: ProtocolSnapshot): DataQualityAssessment {
  if (snapshot.provenance.kind === "DEMO") {
    return {
      confidenceScore: 31,
      level: "LOW",
      components: { dataFreshness: 20, dataCompleteness: 80, sourceCoverage: 25, adapterReliability: 30, modelCalibration: 20 },
      warnings: [
        "DEMO fixture: positions and liquidity are reproducible model inputs, not observed Blend or Stellar state.",
        "No ledger sequence, historical calibration, or cross-venue coverage is available for the demo adapter.",
        "Do not use this report for liquidation, solvency, investment, or operational decisions.",
      ],
    };
  }
  const freshness = snapshot.provenance.kind === "LIVE" ? 90 : snapshot.provenance.kind === "INDEXED" ? 75 : 50;
  const completeness = snapshot.positions.length > 0 && snapshot.liquidity.length > 0 ? 85 : 40;
  const coverage = snapshot.liquidity.some((item) => item.amm) ? 70 : 55;
  const adapter = snapshot.provenance.ledger ? 85 : 60;
  const calibration = 40;
  const confidenceScore = round(freshness * 0.25 + completeness * 0.25 + coverage * 0.2 + adapter * 0.2 + calibration * 0.1, 0);
  return {
    confidenceScore,
    level: confidenceScore >= 75 ? "HIGH" : confidenceScore >= 50 ? "MODERATE" : "LOW",
    components: { dataFreshness: freshness, dataCompleteness: completeness, sourceCoverage: coverage, adapterReliability: adapter, modelCalibration: calibration },
    warnings: calibration < 60 ? ["No historical calibration score has been recorded for this model version."] : [],
  };
}
