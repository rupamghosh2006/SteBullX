"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PositionClassification, StressScenario, StressTestResult } from "@/core/types";
import "./page.css";
import { Meter, Metric, RiskPill, Section } from "@/components/ui";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const FULL_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US");
const fmtUsd = (value: number) => USD.format(value);
const fmtPct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;

export default function StressLabPage() {
  const [scenario, setScenario] = useState<StressScenario>({
    name: "Custom XLM stress test",
    assetPriceShocks: { XLM: -0.2 },
    liquidityShocks: { XLM_USDC: -0.4 },
    oracleDelaySeconds: 30,
    oracle: { delaySeconds: 30, rampSeconds: 30, divergence: 0, staleAfterSeconds: 0, failure: false },
    maxCascadeIterations: 10,
    maxSlippage: 0.1,
  });
  const [result, setResult] = useState<StressTestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = useCallback(async () => {
    setRunning(true); setError(null);
    try {
      const response = await fetch("/api/stress-test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ protocol: "blend", scenario }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Stress test failed.");
      setResult(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to run stress test."); }
    finally { setRunning(false); }
  }, [scenario]);

  useEffect(() => { void runSimulation(); }, []); // Show a usable, deterministic baseline on first load.

  const positionCounts = useMemo(() => {
    const labels: PositionClassification[] = ["HEALTHY", "AT_RISK", "LIQUIDATABLE", "SEVERELY_UNDERCOLLATERALIZED"];
    return labels.map((label) => ({ label, count: result?.positions.filter((position) => position.classification === label).length ?? 0 }));
  }, [result]);
  const maxPositionCount = Math.max(...positionCounts.map((item) => item.count), 1);
  const riskItems = result ? [
    ["Liquidation exposure", result.risk.liquidationExposure], ["Liquidity coverage", result.risk.liquidityCoverage], ["Slippage risk", result.risk.slippageRisk], ["Cascade risk", result.risk.cascadeRisk], ["Bad-debt risk", result.risk.badDebtRisk],
  ] : [];
  const curveMax = Math.max(...(result?.executionCurve.map((row) => row.requestedBaseAmount * row.referencePrice) ?? [1]));

  const update = <K extends keyof StressScenario>(key: K, value: StressScenario[K]) => setScenario((old) => ({ ...old, [key]: value }));
  const updateOracle = (key: keyof StressScenario["oracle"], value: number | boolean) => setScenario((old) => ({ ...old, oracle: { ...old.oracle, [key]: value }, oracleDelaySeconds: key === "delaySeconds" ? Number(value) : old.oracleDelaySeconds }));
  const preset = (priceShock: number, liquidityShock: number) => setScenario((old) => ({ ...old, assetPriceShocks: { XLM: priceShock }, liquidityShocks: { XLM_USDC: liquidityShock }, name: `XLM ${priceShock * 100}% / liquidity ${liquidityShock * 100}%` }));

  return (
    <main>
      <div className="notice"><strong>MODELLED ESTIMATES.</strong> SteBullX does not guarantee solvency, liquidation outcomes, or future market behavior.</div>

      <header className="hero">
        <div><p className="eyebrow">STRESS LAB / DETERMINISTIC MODEL</p><h1>Stress Lab</h1><p className="page-intro">Configure a market shock and watch the liquidation cascade propagate through the modeled book.</p></div>
        <div className="data-stamp"><span>ACTIVE DATASET</span><strong>DEMO / REPRODUCIBLE</strong><small>Blend/XLM–USDC fixture · no live borrower claims</small></div>
      </header>

      <section className="control-panel" aria-label="Stress scenario builder">
        <div className="control-title"><p className="eyebrow">01 / CONFIGURE</p><h2>Scenario builder</h2><p>Blend · XLM/USDC · deterministic data fixture</p></div>
        <div className="fields">
          <label>PROTOCOL<select value="blend" disabled><option>Blend / DEMO</option></select></label>
          <label>PRICE SHOCK / XLM<input aria-label="XLM price shock percent" type="number" min="-99" max="0" value={Math.round(scenario.assetPriceShocks.XLM * 100)} onChange={(e) => update("assetPriceShocks", { XLM: Number(e.target.value) / 100 })} /><em>%</em></label>
          <label>LIQUIDITY SHOCK / XLM–USDC<input aria-label="Liquidity shock percent" type="number" min="-99" max="0" value={Math.round(scenario.liquidityShocks.XLM_USDC * 100)} onChange={(e) => update("liquidityShocks", { XLM_USDC: Number(e.target.value) / 100 })} /><em>%</em></label>
          <label>ORACLE DELAY<input aria-label="Oracle delay seconds" type="number" min="0" max="600" value={scenario.oracle.delaySeconds} onChange={(e) => updateOracle("delaySeconds", Number(e.target.value))} /><em>SEC</em></label>
          <label>ORACLE RAMP<input aria-label="Oracle convergence ramp seconds" type="number" min="1" max="600" value={scenario.oracle.rampSeconds} onChange={(e) => updateOracle("rampSeconds", Number(e.target.value))} /><em>SEC</em></label>
          <label>ORACLE DIVERGENCE<input aria-label="Oracle divergence percent" type="number" min="-50" max="50" value={Math.round(scenario.oracle.divergence * 100)} onChange={(e) => updateOracle("divergence", Number(e.target.value) / 100)} /><em>%</em></label>
          <label>ORACLE STALE-AFTER<input aria-label="Oracle stale-after seconds" type="number" min="0" max="600" value={scenario.oracle.staleAfterSeconds} onChange={(e) => updateOracle("staleAfterSeconds", Number(e.target.value))} /><em>SEC</em></label>
          <label>MAX ITERATIONS<input aria-label="Maximum cascade iterations" type="number" min="1" max="50" value={scenario.maxCascadeIterations} onChange={(e) => update("maxCascadeIterations", Number(e.target.value))} /></label>
          <label>CAPACITY SLIPPAGE<input aria-label="Capacity slippage limit percent" type="number" min="0" max="99" value={Math.round(scenario.maxSlippage * 100)} onChange={(e) => update("maxSlippage", Number(e.target.value) / 100)} /><em>%</em></label>
          <label className="check-field"><span>ORACLE FAILURE (FROZEN AT PRE-SHOCK PRICE)</span><input className="check" aria-label="Oracle failure" type="checkbox" checked={scenario.oracle.failure} onChange={(e) => updateOracle("failure", e.target.checked)} /></label>
        </div>
        <div className="scenario-actions"><div className="presets"><button onClick={() => preset(-0.1, -0.2)}>MILD</button><button onClick={() => preset(-0.2, -0.4)}>SEVERE</button><button onClick={() => preset(-0.3, -0.5)}>EXTREME</button></div><button className="run" disabled={running} onClick={() => void runSimulation()}>{running ? "RUNNING MODEL…" : "RUN STRESS TEST"}<span>↗</span></button></div>
      </section>

      {error && <p className="error">Simulation error: {error}</p>}
      {!result && !error && <p className="loading">Calculating deterministic baseline…</p>}
      {result && <>
        <section className="results-heading"><div><p className="eyebrow">02 / STRESS REPORT</p><h2>Blend / XLM–USDC</h2><p>Generated {new Date(result.generatedAt).toLocaleString()} · {result.methodologyVersion}</p></div><RiskPill level={result.risk.level} score={result.risk.score} /></section>
        <section className="metrics-grid">
          <Metric label="LIQUIDATION CAPACITY" value={fmtUsd(result.summary.liquidationCapacityUsd)} detail={`≤ ${fmtPct(result.scenario.maxSlippage, 0)} modeled slippage`} />
          <Metric label="POTENTIAL BAD DEBT" value={fmtUsd(result.summary.potentialBadDebtUsd)} detail="estimated unrecovered debt" accent="danger-text" />
          <Metric label="CASCADE DEPTH" value={`${result.summary.cascadeDepth} ${result.summary.cascadeDepth === 1 ? "round" : "rounds"}`} detail={`maximum ${result.scenario.maxCascadeIterations} configured`} />
          <Metric label="AFFECTED POSITIONS" value={`${number.format(result.summary.affectedPositions)} / ${number.format(result.summary.totalPositions)}`} detail={`${result.summary.liquidatablePositions} liquidatable in model`} />
        </section>
        <section className="dashboard-grid">
          <Section label="A / POSITION STATE" title="Liquidation distribution"><div className="distribution">{positionCounts.map(({ label, count }) => <div className="bar-row" key={label}><span>{label.replaceAll("_", " ")}</span><Meter value={count / maxPositionCount * 100} tone={label.includes("UNDER") || label === "LIQUIDATABLE" ? "danger" : label === "AT_RISK" ? "warning" : "ok"} /><b>{count}</b></div>)}</div><p className="caption">Classified after the final modeled cascade round; processed positions remain in the underlying fixture for auditability.</p></Section>
          <Section label="B / DEPTH COVERAGE" title="Liquidity vs. liquidation demand"><div className="coverage-bars"><div><span>Normal executable depth</span><Meter value={100} /><b>{fmtUsd(result.summary.normalLiquidityUsd)}</b></div><div><span>Stressed modeled depth</span><Meter value={result.summary.stressedLiquidityUsd / Math.max(result.summary.normalLiquidityUsd, 1) * 100} tone="warning" /><b>{fmtUsd(result.summary.stressedLiquidityUsd)}</b></div><div><span>Liquidation demand</span><Meter value={result.summary.liquidatableCollateralUsd / Math.max(result.summary.normalLiquidityUsd, result.summary.liquidatableCollateralUsd, 1) * 100} tone="danger" /><b>{fmtUsd(result.summary.liquidatableCollateralUsd)}</b></div><div><span>Safe capacity</span><Meter value={result.summary.liquidationCapacityUsd / Math.max(result.summary.liquidatableCollateralUsd, 1) * 100} tone="ok" /><b>{fmtUsd(result.summary.liquidationCapacityUsd)}</b></div></div><p className="caption">Depth combines modeled bid levels and the optional constant-product AMM routes. It is not a quote.</p></Section>
          <Section label="C / EXECUTION MODEL" title="Price impact curve"><div className="curve">{result.executionCurve.map((row) => { const requested = row.requestedBaseAmount * row.referencePrice; return <div className="curve-row" key={requested}><div><span>{FULL_USD.format(requested)} sale</span><Meter value={requested / curveMax * 100} tone={row.slippage > result.scenario.maxSlippage ? "danger" : "light"} /></div><b>{fmtPct(row.priceImpact)}</b><small>{FULL_USD.format(row.recoveredUsd)} estimated recovery</small></div>; })}</div><p className="caption">Estimate only: consumes scenario-scaled bids first, then models a constant-product AMM fill across pools.</p></Section>
          <Section label="D / FEEDBACK LOOP" title="Cascade progression"><div className="cascade">{result.cascade.length ? result.cascade.map((step) => <div className="cascade-step" key={step.iteration}><strong>{String(step.iteration).padStart(2, "0")}</strong><div><span>{step.newlyLiquidatable} newly liquidatable</span><Meter value={step.priceImpact * 350} tone="danger" /><small>{fmtPct(step.priceImpact)} realized execution impact · market XLM {step.marketPriceUsd.toFixed(4)} / oracle {step.oraclePriceUsd.toFixed(4)}</small></div><b>{fmtUsd(step.estimatedBadDebtUsd)}</b></div>) : <p>No modeled liquidations under this configuration.</p>}</div><p className="caption">Each round consumes liquidity, applies a disclosed feedback rule, then revalues all positions.</p></Section>
          <Section label="E / SCORE EXPLAINED" title="Transparent risk breakdown"><div className="risk-list">{riskItems.map(([label, value]) => <div className="risk-row" key={String(label)}><span>{label}</span><Meter value={Number(value)} tone={Number(value) > 70 ? "danger" : Number(value) > 35 ? "warning" : "ok"} /><b>{value}</b></div>)}</div><div className="score-formula">20% exposure + 25% coverage + 20% slippage + 15% cascade + 20% bad debt</div></Section>
          <Section label="F / DATA INTEGRITY" title="Evidence & assumptions"><div className="provenance"><div><span>DATA CLASS</span><b>{result.data.kind}</b></div><div><span>SOURCE</span><b>{result.data.source}</b></div><div><span>SNAPSHOT TIME</span><b>{new Date(result.data.capturedAt).toLocaleString()}</b></div><div><span>CONFIDENCE</span><b>{result.dataQuality.level} · {result.dataQuality.confidenceScore}/100</b></div><div><span>RESULT ID</span><b>{result.id}</b></div></div><details><summary>Show model assumptions ({result.assumptions.length})</summary><ul>{result.assumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul></details></Section>
        </section>
        <footer className="site"><span>STE BULL X · OPEN-SOURCE ECONOMIC RISK INFRASTRUCTURE</span><span>RESULT ID <code>{result.id}</code></span></footer>
      </>}
    </main>
  );
}
