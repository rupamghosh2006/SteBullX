"use client";

import { useCallback, useEffect, useState } from "react";
import { DataStamp, Metric, Section } from "@/components/ui";

interface Episode { id: string; protocol: string; marketId: string; title: string; startLedger: number; endLedger: number; startedAt: string; note: string; observed: { liquidationVolumeUsd: number; badDebtUsd: number; priceImpactPct: number; cascadeDepth: number; affectedPositions: number }; }
interface ReplayResult {
  id: string; episodeId: string; startLedger: number; endLedger: number; modelVersion: string;
  predicted: { liquidationVolumeUsd: number; badDebtUsd: number; priceImpactPct: number; cascadeDepth: number; affectedPositions: number };
  observed: { liquidationVolumeUsd: number; badDebtUsd: number; priceImpactPct: number; cascadeDepth: number; affectedPositions: number };
  errors: { liquidationVolumeErrorPct: number; badDebtErrorPct: number; priceImpactDeltaPct: number; cascadeDepthDelta: number; affectedPositionsDelta: number };
  warnings: string[];
}

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const pct = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`;
const fmtError = (value: number) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

export default function ReplayPage() {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [replay, setReplay] = useState<ReplayResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/replays").then((response) => response.json()).then((payload) => setEpisodes(payload.episodes ?? [])).catch(() => setError("Unable to load replay episodes."));
  }, []);

  const ledgerRange = episodes.length > 0
    ? `${Math.min(...episodes.map((episode) => episode.startLedger)).toLocaleString()} – ${Math.max(...episodes.map((episode) => episode.endLedger)).toLocaleString()}`
    : "—";

  const runReplay = useCallback(async (episodeId: string) => {
    setRunning(true); setError(null);
    try {
      const response = await fetch(`/api/v1/replays/${episodeId}/replay`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Replay failed.");
      setReplay(payload);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to run replay."); }
    finally { setRunning(false); }
  }, []);

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">MODEL VALIDATION</p><h1>Historical Replay</h1><p className="page-intro">Reconstruct protocol state at a pinned ledger, replay the market movement, and compare the prediction against the archived outcome.</p></div>
        <DataStamp fields={[["ARCHIVE", `${episodes.length} episodes`], ["LEDGER RANGE", ledgerRange], ["PURPOSE", "calibration tracking"]]} />
      </header>

      {error && <p className="error">{error}</p>}

      <section className="panel" style={{ marginBottom: 16 }}>
        <p className="eyebrow">EPISODES</p>
        <table>
          <thead><tr><th>EPISODE</th><th>START LEDGER</th><th>END LEDGER</th><th>OBSERVED VOLUME</th><th></th></tr></thead>
          <tbody>
            {episodes.map((episode) => (
              <tr key={episode.id}>
                <td><b>{episode.title}</b><br /><span style={{ color: "var(--muted)", fontSize: 10 }}>{episode.note}</span></td>
                <td>{episode.startLedger.toLocaleString()}</td>
                <td>{episode.endLedger.toLocaleString()}</td>
                <td>{episode.observed?.liquidationVolumeUsd ? USD.format(episode.observed.liquidationVolumeUsd) : "—"}</td>
                <td>
                  <button className="link" style={{ border: 0, background: "none", padding: 0 }} disabled={running} onClick={() => { setSelected(episode.id); void runReplay(episode.id); }}>
                    {running && selected === episode.id ? "REPLAYING…" : "REPLAY →"}
                  </button>
                </td>
              </tr>
            ))}
            {episodes.length === 0 && <tr><td colSpan={5} className="loading">Loading episodes…</td></tr>}
          </tbody>
        </table>
      </section>

      {replay && <>
        <section className="metrics-grid">
          <Metric label="PREDICTED VOLUME" value={USD.format(replay.predicted.liquidationVolumeUsd)} detail={`vs observed ${USD.format(replay.observed.liquidationVolumeUsd)}`} accent={Math.abs(replay.errors.liquidationVolumeErrorPct) > 0.1 ? "danger-text" : undefined} />
          <Metric label="PREDICTED BAD DEBT" value={USD.format(replay.predicted.badDebtUsd)} detail={`vs observed ${USD.format(replay.observed.badDebtUsd)}`} />
          <Metric label="PREDICTED IMPACT" value={pct(replay.predicted.priceImpactPct, 0)} detail={`vs observed ${pct(replay.observed.priceImpactPct, 0)}`} />
          <Metric label="CASCADE DEPTH" value={`${replay.predicted.cascadeDepth} vs ${replay.observed.cascadeDepth}`} detail={`affected: ${replay.predicted.affectedPositions} vs ${replay.observed.affectedPositions}`} />
        </section>

        <section className="panel">
          <p className="eyebrow">MODEL ERROR</p>
          <h2>Prediction vs observed</h2>
          <table>
            <thead><tr><th>METRIC</th><th>PREDICTED</th><th>OBSERVED</th><th>ERROR</th></tr></thead>
            <tbody>
              <tr><td>Liquidation volume</td><td>{USD.format(replay.predicted.liquidationVolumeUsd)}</td><td>{USD.format(replay.observed.liquidationVolumeUsd)}</td><td className={replay.errors.liquidationVolumeErrorPct > 0 ? "neg" : "pos"}>{fmtError(replay.errors.liquidationVolumeErrorPct)}</td></tr>
              <tr><td>Bad debt</td><td>{USD.format(replay.predicted.badDebtUsd)}</td><td>{USD.format(replay.observed.badDebtUsd)}</td><td className={replay.errors.badDebtErrorPct > 0 ? "neg" : "pos"}>{fmtError(replay.errors.badDebtErrorPct)}</td></tr>
              <tr><td>Price impact</td><td>{pct(replay.predicted.priceImpactPct, 0)}</td><td>{pct(replay.observed.priceImpactPct, 0)}</td><td className={replay.errors.priceImpactDeltaPct > 0 ? "neg" : "pos"}>{replay.errors.priceImpactDeltaPct.toFixed(1)}pp</td></tr>
              <tr><td>Cascade depth</td><td>{replay.predicted.cascadeDepth}</td><td>{replay.observed.cascadeDepth}</td><td className={replay.errors.cascadeDepthDelta !== 0 ? "neg" : "pos"}>{replay.errors.cascadeDepthDelta > 0 ? `+${replay.errors.cascadeDepthDelta}` : replay.errors.cascadeDepthDelta}</td></tr>
            </tbody>
          </table>
          {replay.warnings.map((warning) => <p className="caption" key={warning}>⚠ {warning}</p>)}
          <p className="caption" style={{ marginBottom: 0 }}>Replay {replay.id} · model {replay.modelVersion} · error metrics feed model calibration.</p>
        </section>
      </>}
    </main>
  );
}
