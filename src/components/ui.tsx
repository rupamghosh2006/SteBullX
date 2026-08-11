export function Meter({ value, tone = "light" }: { value: number; tone?: "danger" | "warning" | "light" | "ok" }) {
  return <span className={`meter ${tone}`}><i style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></span>;
}

export function Metric({ label, value, detail, accent }: { label: string; value: string; detail?: string; accent?: string }) {
  return <article className="metric"><span>{label}</span><strong className={accent}>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export function Section({ label, title, children, footer }: { label: string; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <section className="panel"><p className="eyebrow">{label}</p><h2>{title}</h2>{children}{footer}</section>;
}

export function RiskPill({ level, score }: { level: string; score: number }) {
  return <div className={`risk-pill ${level.toLowerCase()}`}><small>OVERALL RISK</small><strong>{level}</strong><span>{score}/100</span></div>;
}

export function DataStamp({ fields }: { fields: Array<[string, string]> }) {
  return <div className="data-stamp">{fields.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>;
}
