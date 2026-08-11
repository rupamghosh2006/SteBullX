import type { Metadata } from "next";
import Link from "next/link";
import { cannedRuns, fixtureSnapshot, totalCollateralUsd, totalDebtUsd } from "@/lib/demo-analytics";
import { DataStamp, Metric, RiskPill, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Protocols | SteBullX" };

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });

export default function ProtocolsPage() {
  const severe = cannedRuns.severe;
  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">PROTOCOL ADAPTERS</p><h1>Protocols</h1><p className="page-intro">One production-quality adapter at a time. The simulation engine never hardcodes a protocol.</p></div>
        <DataStamp fields={[["DATA CLASS", fixtureSnapshot.provenance.kind], ["ADAPTER INTERFACE", "ProtocolAdapter"], ["ROADMAP", "Templar · Kinetic"]]} />
      </header>

      <section className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
          <div>
            <p className="eyebrow">01 / BLEND</p>
            <h2 style={{ marginBottom: 6 }}>Blend (reproducible demo adapter)</h2>
            <p className="caption" style={{ margin: 0, maxWidth: 560 }}>Lending protocol adapter backed by a deterministic fixture. Positions, risk parameters and liquidity are exposed through the standard <code>ProtocolAdapter</code> interface.</p>
          </div>
          <RiskPill level={severe.risk.level} score={severe.risk.score} />
        </div>
      </section>

      <section className="metrics-grid">
        <Metric label="TVL IN MODEL" value={USD.format(totalCollateralUsd)} detail="total collateral value" />
        <Metric label="OUTSTANDING DEBT" value={USD.format(totalDebtUsd)} detail="USDC-denominated" />
        <Metric label="MARKETS" value="1" detail="XLM / USDC" />
        <Metric label="POSITIONS" value={String(fixtureSnapshot.positions.length)} detail="fixture borrows" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: 28 }}>
        <Section label="A / RISK PARAMETERS" title="Protocol configuration">
          <table>
            <thead><tr><th>ASSET</th><th>COLLATERAL FACTOR</th><th>LIQ. THRESHOLD</th><th>LIQ. BONUS</th></tr></thead>
            <tbody>
              {Object.entries(fixtureSnapshot.risk.liquidationThreshold).map(([asset, threshold]) => (
                <tr key={asset}><td><b>{asset}</b></td><td>{fixtureSnapshot.risk.collateralFactor[asset]}</td><td>{threshold}</td><td>{fixtureSnapshot.risk.liquidationBonus[asset]}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="caption">Parameters are consumed from the adapter, never hardcoded in the engine.</p>
        </Section>
        <Section label="B / ADAPTER CONTRACT" title="What the engine sees">
          <div className="codeblock">{`getMarkets()          → Market[]
getPositions()       → Position[]
getRiskParameters()  → RiskParameters
getCollateralAssets()→ Asset[]
getDebtAssets()      → Asset[]
getSnapshot()        → ProtocolSnapshot`}</div>
          <p className="caption">A new Stellar lending protocol integrates by implementing this interface. See <Link className="link" href="/docs">Documentation</Link>.</p>
        </Section>
      </section>
    </main>
  );
}
