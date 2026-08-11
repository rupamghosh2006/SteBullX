import type { Metadata } from "next";
import { Section } from "@/components/ui";

export const metadata: Metadata = { title: "API | SteBullX" };

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/protocols", note: "Supported protocols and adapters." },
  { method: "GET", path: "/api/v1/markets", note: "Markets with spot reference and executable depth." },
  { method: "GET", path: "/api/v1/positions", note: "Protocol positions from the active snapshot." },
  { method: "GET", path: "/api/v1/liquidity", note: "Order-book levels and AMM pools." },
  { method: "GET", path: "/api/v1/replays", note: "Historical replay archive episodes." },
  { method: "GET", path: "/api/v1/replays/:id", note: "Single archived episode." },
  { method: "POST", path: "/api/v1/replays/:id/replay", note: "Run a replay and get prediction-vs-observed errors." },
  { method: "POST", path: "/api/v1/stress-tests", note: "Run a stress test synchronously (201 + full result)." },
  { method: "POST", path: "/api/v1/stress-tests/async", note: "Enqueue a stress test (202 + job id)." },
  { method: "GET", path: "/api/v1/jobs/:id", note: "Poll job status; result included when done." },
  { method: "GET", path: "/api/v1/stress-tests/:id", note: "Fetch a stored result by deterministic id." },
  { method: "GET", path: "/api/v1/metrics", note: "Observability counters and durations." },
] as const;

export default function ApiPage() {
  return (
    <main>
      <header className="hero">
        <div><p className="eyebrow">DEVELOPER API</p><h1>API</h1><p className="page-intro">SteBullX is infrastructure first: every simulation is reproducible and addressable by deterministic id.</p></div>
        <div className="data-stamp"><span>AUTH</span><strong>OPTIONAL API KEY</strong><small>x-api-key header · timing-safe compare</small></div>
      </header>

      <Section label="ENDPOINTS" title="REST reference">
        <table>
          <thead><tr><th>METHOD</th><th>PATH</th><th>DESCRIPTION</th></tr></thead>
          <tbody>
            {ENDPOINTS.map((endpoint) => (
              <tr key={endpoint.method + endpoint.path}><td><b>{endpoint.method}</b></td><td><code>{endpoint.path}</code></td><td>{endpoint.note}</td></tr>
            ))}
          </tbody>
        </table>
      </Section>

      <section className="dashboard-grid" style={{ marginTop: 16 }}>
        <Section label="EXAMPLE / RUN" title="Run a stress test">
          <div className="codeblock">{`POST /api/v1/stress-tests
{ "protocol": "blend",
  "scenario": {
    "assetPriceShocks": { "XLM": -0.3 },
    "liquidityShocks": { "XLM_USDC": -0.4 },
    "oracle": { "delaySeconds": 30, "rampSeconds": 30,
                "divergence": 0, "staleAfterSeconds": 0,
                "failure": false },
    "maxCascadeIterations": 10,
    "maxSlippage": 0.1 } }`}</div>
          <p className="caption">Response includes summary, risk decomposition, confidence, audit hashes and the deterministic result id.</p>
        </Section>
        <Section label="EXAMPLE / ASYNC" title="Queue a job, then poll">
          <div className="codeblock">{`POST /api/v1/stress-tests/async
→ 202 { "jobId": "JOB-3FA92C01-77A" }

GET /api/v1/jobs/JOB-3FA92C01-77A
→ { "job": { "status": "SUCCEEDED",
              "resultId": "STRESS-1C4B..." },
    "result": { ... } }`}</div>
          <p className="caption">Without REDIS_URL, async jobs complete in-process. With Redis, run `npm run worker` (see Docker).</p>
        </Section>
      </section>
    </main>
  );
}
