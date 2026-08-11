import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui";

export const metadata: Metadata = { title: "Scenarios | SteBullX" };

const CATALOG = [
  { name: "MILD", shocks: "XLM −10% · liquidity −20%", oracle: "30s lag / 30s ramp", note: "Shallow stress: capacity holds, limited bad debt." },
  { name: "SEVERE", shocks: "XLM −20% · liquidity −40%", oracle: "30s lag / 30s ramp", note: "Cascade crosses capacity; model shows material bad debt." },
  { name: "EXTREME", shocks: "XLM −30% · liquidity −50%", oracle: "30s lag / 30s ramp", note: "Liquidity collapse; execution impact dominates." },
  { name: "STALE ORACLE", shocks: "XLM −25% · liquidity −40%", oracle: "stale after 60s", note: "Feed freezes mid-crash; late valuations create a single big wave." },
  { name: "ORACLE FAILURE", shocks: "XLM −30% · liquidity −40%", oracle: "failed (frozen)", note: "Protocol keeps valuing at the pre-shock price — liquidations only trigger for positions already underwater." },
  { name: "DIVERGENT ORACLE", shocks: "XLM −20% · liquidity −30%", oracle: "reports +5% bias", note: "Overvaluation inflates health factors and defers liquidations." },
] as const;

export default function ScenariosPage() {
  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">SCENARIO CATALOG</p><h1>Scenarios</h1><p className="page-intro">Reusable stress definitions combining price shocks, liquidity drawdowns and oracle failures. Every scenario is deterministic.</p></div>
        <div className="data-stamp"><span>COMPOSITION</span><strong>PRICE + LIQUIDITY + ORACLE</strong><small>fully customisable in the Stress Lab</small></div>
      </header>
      <section className="dashboard-grid">
        {CATALOG.map((scenario) => (
          <Section key={scenario.name} label={scenario.name} title={scenario.shocks}>
            <div className="kv" style={{ marginTop: 8 }}>
              <div><span>ORACLE MODEL</span><b>{scenario.oracle}</b></div>
            </div>
            <p className="caption">{scenario.note}</p>
          </Section>
        ))}
      </section>
      <p style={{ marginTop: 24 }}><Link className="link" href="/stress-lab">Open the Stress Lab →</Link></p>
    </main>
  );
}
