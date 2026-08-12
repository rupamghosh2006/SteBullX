import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui";
import { modelVersion } from "@/lib/demo-analytics";

export const metadata: Metadata = { title: "Documentation | SteBullX" };

const DOCS = [
  {
    name: "ARCHITECTURE.md",
    note: "Detailed architecture: ingestion -> normalization -> simulation -> risk.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/Architecture.md",
  },
  {
    name: "methodology.md",
    note: "Model formulas, weights, and scoring rules.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/docs/methodology.md",
  },
  {
    name: "API.md",
    note: "Full REST reference and examples.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/docs/API.md",
  },
  {
    name: "REPRODUCIBILITY.md",
    note: "Hashes, deterministic IDs, and how to reproduce a result.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/docs/REPRODUCIBILITY.md",
  },
  {
    name: "MODEL_LIMITATIONS.md",
    note: "What the model does not claim.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/docs/MODEL_LIMITATIONS.md",
  },
  {
    name: "SECURITY.md",
    note: "Non-custodial design, key handling, and validation.",
    href: "https://github.com/rupamghosh2006/SteBullX/blob/main/docs/SECURITY.md",
  },
] as const;

export default function DocsPage() {
  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">DOCUMENTATION</p>
          <h1>Documentation</h1>
          <p className="page-intro">Open methodology, explicit assumptions, and reproducibility instructions. The core engine is open source.</p>
        </div>
        <div className="data-stamp"><span>MODEL</span><strong>{modelVersion}</strong><small>every result identifies its model version</small></div>
      </header>

      <section className="dashboard-grid">
        <Section label="MODEL SAFETY" title="What SteBullX claims">
          <ul style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.7, paddingLeft: 16 }}>
            <li>Simulations are deterministic given the same snapshot, scenario, and model version.</li>
            <li>Results are <strong>modeled estimates</strong>, never predictions of the future or guarantees of solvency.</li>
            <li>Every result carries data provenance, assumptions, model version, and a confidence score.</li>
            <li>Observed, estimated, and simulated data are always labelled separately.</li>
          </ul>
          <p className="caption">Absolute rule: never fabricate live blockchain data or present mock data as real.</p>
        </Section>
        <Section label="DOCUMENTATION" title="Repository docs">
          <table>
            <thead><tr><th>DOC</th><th>CONTENT</th></tr></thead>
            <tbody>
              {DOCS.map(({ name, note, href }) => (
                <tr key={name}>
                  <td><Link className="link" href={href} target="_blank" rel="noreferrer">{name}</Link></td>
                  <td>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </section>

      <Section label="ROADMAP" title="Towards risk infrastructure" footer={<p className="caption">From a single protocol adapter to systemic Stellar DeFi risk graph.</p>}>
        <table>
          <thead><tr><th>V</th><th>MILESTONE</th></tr></thead>
          <tbody>
            <tr><td><b>1</b></td><td>Stellar lending stress testing (current: Blend adapter, deterministic engine, replay + calibration workflow)</td></tr>
            <tr><td><b>2</b></td><td>Multi-protocol stress testing (Templar, Kinetic)</td></tr>
            <tr><td><b>3</b></td><td>Live ledger indexing and historical state reconstruction</td></tr>
            <tr><td><b>4</b></td><td>Public risk API with keys and rate limits</td></tr>
            <tr><td><b>5</b></td><td>Continuous risk monitoring and alerts</td></tr>
            <tr><td><b>6</b></td><td>Systemic Stellar DeFi dependency graph</td></tr>
            <tr><td><b>7</b></td><td>Probabilistic / Monte Carlo risk engine</td></tr>
            <tr><td><b>8</b></td><td>On-chain risk attestations (Soroban StressAttestationRegistry)</td></tr>
          </tbody>
        </table>
      </Section>
    </main>
  );
}
