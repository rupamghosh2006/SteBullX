import type { Metadata } from "next";
import { cannedRuns, fixtureSnapshot } from "@/lib/demo-analytics";
import { DataStamp, Metric, Meter, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Markets | SteBullX" };

const FULL_USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, notation: "compact" });
const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

export default function MarketsPage() {
  const market = fixtureSnapshot.markets[0];
  const liquidity = fixtureSnapshot.liquidity[0];
  const severe = cannedRuns.severe;
  const curveMax = Math.max(...severe.executionCurve.map((row) => row.requestedBaseAmount * row.referencePrice));

  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">MARKET MICROSTRUCTURE</p><h1>Markets</h1><p className="page-intro">The liquidity picture that feeds the simulation engine. Depth, pools and modeled impact curves.</p></div>
        <DataStamp fields={[["PAIR", "XLM / USDC"], ["REFERENCE PRICE", `$${market.spotPrice.toFixed(3)}`], ["EXECUTABLE DEPTH", USD.format(market.executableDepthUsd)]]} />
      </header>

      <section className="metrics-grid">
        <Metric label="SPOT PRICE" value={`$${market.spotPrice.toFixed(3)}`} detail="reference / XLM" />
        <Metric label="ORDER-BOOK DEPTH" value={USD.format(market.executableDepthUsd)} detail="5 modeled bid levels" />
        <Metric label="AMM POOLS" value={String(liquidity.amms?.length ?? 0)} detail="constant-product routes" />
        <Metric label="POOL RESERVES" value={USD.format((liquidity.amms ?? []).reduce((acc, pool) => acc + pool.quoteReserve, 0))} detail="combined quote reserves" />
      </section>

      <section className="dashboard-grid" style={{ marginTop: 28 }}>
        <Section label="A / SDEX ORDER BOOK" title="Bid depth">
          <table>
            <thead><tr><th>PRICE (USD)</th><th>BASE AMOUNT</th><th>USD VALUE</th><th>CUMULATIVE</th></tr></thead>
            <tbody>
              {liquidity.bidLevels.map((level, index) => {
                const cumulative = liquidity.bidLevels.slice(0, index + 1).reduce((acc, item) => acc + item.baseAmount * item.price, 0);
                const total = liquidity.bidLevels.reduce((acc, item) => acc + item.baseAmount * item.price, 0);
                return (
                  <tr key={level.price}><td><b>${level.price.toFixed(4)}</b></td><td>{level.baseAmount.toLocaleString()} XLM</td><td>{FULL_USD.format(level.baseAmount * level.price)}</td><td>{USD.format(cumulative)} · {pct(cumulative / total)}</td></tr>
                );
              })}
            </tbody>
          </table>
          <p className="caption">Fixture depth only. Live adapter would surface the Horizon order book at the pinned ledger.</p>
        </Section>
        <Section label="B / AMM POOLS" title="Constant-product routes">
          <table>
            <thead><tr><th>POOL</th><th>BASE RESERVE</th><th>QUOTE RESERVE</th><th>FEE</th><th>TOUCH PRICE</th></tr></thead>
            <tbody>
              {(liquidity.amms ?? []).map((pool) => (
                <tr key={pool.id}><td><b>{pool.id}</b></td><td>{pool.baseReserve.toLocaleString()} XLM</td><td>{FULL_USD.format(pool.quoteReserve)}</td><td>{pool.feeBps / 100}%</td><td>${(pool.quoteReserve / pool.baseReserve).toFixed(4)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="caption">Execution participates up to 75% of quote reserves per pool, in price priority with the book.</p>
        </Section>
        <Section label="C / PRICE IMPACT" title="Modeled impact curve (SEVERE: XLM −20%)">
          <div className="curve">
            {severe.executionCurve.map((row) => {
              const requested = row.requestedBaseAmount * row.referencePrice;
              return (
                <div className="curve-row" key={requested}>
                  <div><span>{FULL_USD.format(requested)} sale</span><Meter value={requested / curveMax * 100} tone={row.slippage > severe.scenario.maxSlippage ? "danger" : "light"} /></div>
                  <b>{pct(row.priceImpact)}</b><small>{FULL_USD.format(row.recoveredUsd)} recovery</small>
                </div>
              );
            })}
          </div>
          <p className="caption">Deterministic estimates from the stressed liquidity state; not a quote.</p>
        </Section>
        <Section label="D / VENUE SPLIT" title="Where collateral gets sold">
          <div className="kv">
            {severe.executionCurve[severe.executionCurve.length - 1].venues.map((venue) => (
              <div key={venue.venueId}><span>{venue.venueId}</span><b>{USD.format(venue.quoteUsd)} @ ${venue.averagePrice.toFixed(4)}</b></div>
            ))}
          </div>
          <p className="caption">Venue breakdown from the largest modeled sale; average price is per venue.</p>
        </Section>
      </section>
    </main>
  );
}
