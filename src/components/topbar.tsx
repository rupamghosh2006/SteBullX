"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import steBullXLogo from "../../Public/logo.png";

const NAV = [
  ["/", "Overview"],
  ["/stress-lab", "Stress Lab"],
  ["/protocols", "Protocols"],
  ["/markets", "Markets"],
  ["/liquidations", "Liquidations"],
  ["/scenarios", "Scenarios"],
  ["/replay", "Historical Replay"],
  ["/risk-reports", "Risk Reports"],
  ["/api", "API"],
  ["/docs", "Documentation"],
] as const;

export function Topbar() {
  const pathname = usePathname();
  return (
    <div className="topbar">
      <Link className="brand" href="/" aria-label="SteBullX home">
        <Image className="brand-logo" src={steBullXLogo} alt="SteBullX bull mark" priority />
        <span className="brand-name"><b>STE</b><span>BULL</span><b>X</b></span>
      </Link>
      <nav className="site-nav" aria-label="Primary">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"}>{label}</Link>
        ))}
      </nav>
      <div className="topmeta"><span className="status-dot" /> STELLAR DEFI RISK INFRASTRUCTURE <span className="sep">/</span> MVP 0.2</div>
    </div>
  );
}
