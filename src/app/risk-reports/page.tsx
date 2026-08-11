import type { Metadata } from "next";
import { cannedRuns, modelVersion } from "@/lib/demo-analytics";
import { Metric, Meter, RiskPill, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Risk Reports | SteBullX" };

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });

export default function RiskReportsPage() {
  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">RISK REPORTS</p><h1>Risk Reports</h1><p className="page-intro">Every score decomposes into measurable components. No black boxes, no unexplained numbers.</p></div>
        <div className="data-stamp"><span>MODEL</span><strong>{modelVersion}</strong><small>deterministic · hashed inputs and outputs</small></div>
      </header>

      <section className="panel" style={{ marginBottom: 16 }}>
        <p className="eyebrow">SCENARIO SWEEP</p>
        <table>
          <thead><tr><th>SCENARIO</th><th>RISK</th><th>BAD DEBT</th><th>CASCADE</th><th>CONFIDENCE</th></tr></thead>
          <tbody>
            {Object.entries(cannedRuns).map(([key, run]) => (
              <tr key={key} id={key}>
                <td><b>{run.scenario.name}</b></td>
                <td>{run.risk.level} · {run.risk.score}/100</td>
                <td>{USD.format(run.summary.potentialBadDebtUsd)}</td>
                <td>{run.summary.cascadeDepth} rounds</td>
                <td>{run.dataQuality.level} · {run.dataQuality.confidenceScore}/100</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {Object.entries(cannedRuns).map(([key, run]) => (
        <section className="dashboard-grid" key={key} style={{ marginBottom: 16 }}>
          <Section label={`REPORT / ${key.toUpperCase()}`} title={run.scenario.name}>
            <RiskPill level={run.risk.level} score={run.risk.score} />
            <div className="kv" style={{ marginTop: 14 }}>
              <div><span>LIQUIDATION EXPOSURE</span><b>{USD.format(run.summary.liquidationExposureUsd)}</b></div>
              <div><span>LIQUIDATION CAPACITY</span><b>{USD.format(run.summary.liquidationCapacityUsd)}</b></div>
              <div><span>RECOVERABLE VALUE</span><b>{USD.format(run.summary.estimatedRecoverableValueUsd)}</b></div>
              <div><span>POTENTIAL BAD DEBT</span><b>{USD.format(run.summary.potentialBadDebtUsd)}</b></div>
            </div>
            <p className="caption">Result {run.id} · data {run.data.kind} · stress loss equals modeled bad debt.</p>
          </Section>
          <Section label="SCORE EXPLAINED" title="Risk decomposition">
            <div className="risk-list">
              {([["Liquidation exposure", run.risk.liquidationExposure], ["Liquidity coverage", run.risk.liquidityCoverage], ["Slippage risk", run.risk.slippageRisk], ["Cascade risk", run.risk.cascadeRisk], ["Bad-debt risk", run.risk.badDebtRisk]] as const).map(([label, value]) => (
                <div className="risk-row" key={label}><span>{label}</span><Meter value={value} tone={value > 70 ? "danger" : value > 35 ? "warning" : "ok"} /><b>{value}</b></div>
              ))}
            </div>
            <div className="score-formula">20% exposure + 25% coverage + 20% slippage + 15% cascade + 20% bad debt</div>
            <p className="caption">Components are derived from modeled quantities; weights are documented in the methodology.</p>
          </Section>
        </section>
      ))}
    </main>
  );
}
