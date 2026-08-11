import type { Metadata } from "next";
import { cannedRuns, fixtureSnapshot, modelVersion, totalCollateralUsd, totalDebtUsd } from "@/lib/demo-analytics";
import { Metric, Meter, RiskPill, Section } from "@/components/ui";
import Link from "next/link";

export const metadata: Metadata = { title: "Overview | SteBullX" };

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const FULL_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export default function OverviewPage() {
  const severe = cannedRuns.severe;
  const exposure = severe.summary.liquidationExposureUsd;
  const capacity = severe.summary.liquidationCapacityUsd;
  const coverage = exposure > 0 ? capacity / exposure : 1;
  const worst = cannedRuns.extreme;

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">ECONOMIC STRESS TESTING / STELLAR</p>
          <h1>Stress-test Stellar DeFi<br />before it gets rekt.</h1>
          <p className="page-intro">A liquidation-capacity simulator for the moment isolated health factors stop being enough.</p>
        </div>
        <RiskPill level={worst.risk.level} score={worst.risk.score} />
      </header>
      <div className="notice"><strong>MODELLED ESTIMATES.</strong> SteBullX does not guarantee solvency, liquidation outcomes, or future market behavior. Data shown is a reproducible {fixtureSnapshot.provenance.kind} fixture unless marked otherwise.</div>

      <section className="metrics-grid" aria-label="Ecosystem metrics">
        <Metric label="TRACKED PROTOCOLS" value="1" detail="Blend adapter · roadmap: Templar, Kinetic" />
        <Metric label="TRACKED TVL" value={USD.format(totalCollateralUsd)} detail={`${FULL_USD.format(totalDebtUsd)} debt in model`} />
        <Metric label="LIQUIDATABLE EXPOSURE" value={USD.format(exposure)} detail={`under SEVERE (XLM −20%)`} accent="danger-text" />
        <Metric label="EST. LIQUIDATION CAPACITY" value={USD.format(capacity)} detail={`≤ 10% modeled slippage`} />
      </section>
      <section className="metrics-grid" aria-label="Coverage">
        <Metric label="STRESS COVERAGE" value={pct(Math.min(coverage, 1))} detail="capacity ÷ exposure (SEVERE)" accent={coverage >= 0.65 ? undefined : "danger-text"} />
        <Metric label="HIGHEST RISK PROTOCOL" value="Blend / XLM" detail={`risk ${worst.risk.level} · score ${worst.risk.score}/100`} />
        <Metric label="POTENTIAL BAD DEBT" value={USD.format(severe.summary.potentialBadDebtUsd)} detail="SEVERE scenario, modeled" accent="danger-text" />
        <Metric label="MODEL VERSION" value={modelVersion} detail="deterministic · reproducible IDs" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: 28 }}>
        <Section label="A / SCENARIO SWEEP" title="Risk by shock depth">
          <div className="kv" style={{ marginTop: 10 }}>
            {Object.entries(cannedRuns).map(([key, run]) => (
              <div key={key}><span>{run.scenario.name}</span><b><Link className="link" href={`/risk-reports#${key}`}>{run.risk.level} · {run.risk.score}/100</Link></b></div>
            ))}
          </div>
          <p className="caption">All three runs share the same Blend/XLM-USDC fixture, oracle lag (30s) and liquidity model. Sweep results are deterministic.</p>
        </Section>
        <Section label="B / DATA INTEGRITY" title="Evidence & assumptions">
          <DataQuality />
          <p className="caption">Every simulation carries provenance, input/scenario/result hashes and a model version for full reproducibility.</p>
        </Section>
      </section>
    </main>
  );
}

function DataQuality() {
  const severe = cannedRuns.severe;
  return (
    <div className="kv">
      <div><span>DATA CLASS</span><b>{severe.data.kind}</b></div>
      <div><span>SOURCE</span><b>{severe.data.source}</b></div>
      <div><span>CONFIDENCE</span><b>{severe.dataQuality.level} · {severe.dataQuality.confidenceScore}/100</b></div>
      <div><span>MODEL VERSION</span><b>{severe.audit.modelVersion}</b></div>
    </div>
  );
}
