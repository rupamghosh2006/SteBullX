import type { Metadata } from "next";
import { cannedRuns, fixtureSnapshot } from "@/lib/demo-analytics";
import { DataStamp, Metric, Meter, Section } from "@/components/ui";
import type { RevaluedPosition } from "@/core/types";

export const metadata: Metadata = { title: "Liquidations | SteBullX" };

const FULL_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const pct = (value: number, digits = 2) => `${(value * 100).toFixed(digits)}%`;

const isLiquidatable = (position: RevaluedPosition) => position.classification === "LIQUIDATABLE" || position.classification === "SEVERELY_UNDERCOLLATERALIZED";

export default function LiquidationsPage() {
  const severe = cannedRuns.severe;
  const liquidatable = severe.positions.filter(isLiquidatable).sort((a, b) => a.healthFactor - b.healthFactor);

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">LIQUIDATION ANALYSIS</p><h1>Liquidations</h1><p className="page-intro">Positions that cross the threshold, the execution they trigger, and the capacity that absorbs them. Analytical only — no bot.</p></div>
        <DataStamp fields={[["SCENARIO", severe.scenario.name], ["RESULT ID", severe.id], ["MODEL", severe.audit.modelVersion]]} />
      </header>

      <section className="metrics-grid">
        <Metric label="LIQUIDATABLE POSITIONS" value={String(severe.summary.liquidatablePositions)} detail={`of ${severe.summary.totalPositions} total`} />
        <Metric label="LIQUIDATION VOLUME" value={USD.format(severe.summary.liquidatableCollateralUsd)} detail="collateral to process" accent="danger-text" />
        <Metric label="LIQUIDATION CAPACITY" value={USD.format(severe.summary.liquidationCapacityUsd)} detail={`≤ ${pct(severe.scenario.maxSlippage, 0)} slippage`} />
        <Metric label="EXPECTED RECOVERY" value={USD.format(severe.summary.estimatedRecoverableValueUsd)} detail="after modeled impact" />
      </section>

      <section className="panel" style={{ margin: "28px 0 16px" }}>
        <p className="eyebrow">CASCADE HISTORY / SEVERE</p>
        <h2>Round by round</h2>
        {severe.cascade.map((step) => (
          <div className="bar-row" key={step.iteration}><span>Round {step.iteration + 1} · t+{step.elapsedSeconds}s</span><Meter value={step.priceImpact * 350} tone="danger" /><b>{step.newlyLiquidatable} pos · {pct(step.priceImpact)}</b></div>
        ))}
      </section>

      <section className="panel">
        <p className="eyebrow">LIQUIDATABLE IN MODEL</p>
        <h2>Positions crossing the threshold</h2>
        <table>
          <thead><tr><th>POSITION</th><th>HEALTH FACTOR</th><th>COLLATERAL</th><th>DEBT</th><th>STATUS</th></tr></thead>
          <tbody>
            {liquidatable.map((position) => (
              <tr key={position.id}><td><b>{position.id}</b></td><td>{position.healthFactor.toFixed(3)}</td><td>{FULL_USD.format(position.collateralValueUsd)}</td><td>{FULL_USD.format(position.debtValueUsd)}</td><td>{position.classification.replaceAll("_", " ")}</td></tr>
            ))}
            {liquidatable.length === 0 && <tr><td colSpan={5}>No liquidatable positions under this scenario.</td></tr>}
          </tbody>
        </table>
        <p className="caption">Revalued at final market prices after the cascade; the fixture remains unchanged for auditability.</p>
      </section>

      <section className="dashboard-grid" style={{ marginTop: 16 }}>
        <Section label="A / CAPACITY" title="Can the market absorb the demand?">
          <div className="coverage-bars">
            <div><span>Liquidation demand</span><Meter value={100} tone="danger" /><b>{USD.format(severe.summary.liquidatableCollateralUsd)}</b></div>
            <div><span>Modeled capacity</span><Meter value={severe.summary.liquidationCapacityUsd / Math.max(severe.summary.liquidatableCollateralUsd, 1) * 100} tone="warning" /><b>{USD.format(severe.summary.liquidationCapacityUsd)}</b></div>
          </div>
          <p className="caption">Coverage {pct(severe.summary.liquidationCapacityUsd / Math.max(severe.summary.liquidatableCollateralUsd, 1))} — demand beyond capacity is modeled as unrecoverable.</p>
        </Section>
        <Section label="B / COLLATERAL TYPES" title="What gets liquidated">
          <div className="kv">
            {fixtureSnapshot.assets.map((asset) => {
              const exposure = severe.positions.filter(isLiquidatable).reduce((acc, position) => acc + position.collateralValueUsd * position.collateral.filter((amount) => amount.assetId === asset.id).reduce((sum, amount) => sum + amount.amount, 0) / Math.max(position.collateral.reduce((sum, amount) => sum + amount.amount, 0), 1), 0);
              return <div key={asset.id}><span>{asset.symbol}</span><b>{USD.format(exposure)}</b></div>;
            })}
          </div>
          <p className="caption">Collateral exposure per asset among liquidatable positions (single-asset fixture: XLM).</p>
        </Section>
      </section>
    </main>
  );
}
