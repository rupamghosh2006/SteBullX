"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import steBullXLogo from "../../Public/logo.png";

const PRIMARY_NAV = [
  ["/", "Overview"],
  ["/stress-lab", "Stress Lab"],
  ["/markets", "Markets"],
] as const;

const EXPLORE_NAV = [
  { href: "/protocols", title: "Protocols", description: "Compare risk across supported protocols" },
  { href: "/liquidations", title: "Liquidations", description: "Trace capacity and cascade exposure" },
  { href: "/scenarios", title: "Scenarios", description: "Review reproducible shock configurations" },
  { href: "/replay", title: "Historical replay", description: "Test the model against past market moves" },
  { href: "/risk-reports", title: "Risk reports", description: "Review modeled ecosystem risk" },
  { href: "/api", title: "API", description: "Bring risk metrics into your own tools" },
] as const;

export function Topbar() {
  const pathname = usePathname();
  const [exploreOpen, setExploreOpen] = useState(false);
  const isExploreActive = EXPLORE_NAV.some((item) => item.href === pathname);

  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="SteBullX home">
        <Image className="brand-logo" src={steBullXLogo} alt="SteBullX bull mark" priority />
        <span className="brand-name"><b>Ste</b><span>Bull</span><b>X</b></span>
      </Link>
      <nav className="site-nav" aria-label="Primary">
        {PRIMARY_NAV.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? "nav-link active" : "nav-link"}>{label}</Link>
        ))}
        <div
          className="nav-dropdown"
          onMouseEnter={() => setExploreOpen(true)}
          onMouseLeave={() => setExploreOpen(false)}
          onFocus={() => setExploreOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExploreOpen(false);
          }}
        >
          <button
            className={isExploreActive ? "nav-link nav-trigger active" : "nav-link nav-trigger"}
            type="button"
            aria-expanded={exploreOpen}
            aria-haspopup="menu"
            onClick={() => setExploreOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setExploreOpen(false);
            }}
          >
            Explore <span className="nav-chevron" aria-hidden="true">⌄</span>
          </button>
          <div className={exploreOpen ? "nav-popover is-open" : "nav-popover"} aria-label="Explore SteBullX" role="menu">
            {EXPLORE_NAV.map((item) => (
              <Link
                className="nav-popover-item"
                href={item.href}
                key={item.href}
                role="menuitem"
                onClick={() => setExploreOpen(false)}
              >
                <span>{item.title}</span>
                <small>{item.description}</small>
              </Link>
            ))}
          </div>
        </div>
      </nav>
      <div className="topbar-actions">
        <Link className="topbar-docs" href="/docs">Documentation</Link>
        <Link className="launch-link" href="/stress-lab">Launch lab <span aria-hidden="true">↗</span></Link>
      </div>
    </header>
  );
}
