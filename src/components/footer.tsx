import Image from "next/image";
import Link from "next/link";
import steBullXLogo from "../../Public/logo.png";

const productLinks = [
  ["Overview", "/"],
  ["Stress Lab", "/stress-lab"],
  ["Markets", "/markets"],
  ["Protocols", "/protocols"],
  ["Liquidations", "/liquidations"],
] as const;

const resourceLinks = [
  ["Scenarios", "/scenarios"],
  ["Historical Replay", "/replay"],
  ["Risk Reports", "/risk-reports"],
  ["Developer API", "/api"],
  ["Documentation", "/docs"],
] as const;

const externalLinks = [
  ["X / @stebullx", "https://x.com/stebullx"],
  ["GitHub repository", "https://github.com/rupamghosh2006/SteBullX"],
  ["Architecture", "https://github.com/rupamghosh2006/SteBullX/blob/main/Architecture.md"],
] as const;

const legalLinks = [
  ["Terms of Use", "/terms"],
  ["Privacy Policy", "/privacy"],
  ["Cookies", "/cookies"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-grid">
        <section className="site-footer-intro" aria-label="About SteBullX">
          <Link className="site-footer-brand" href="/" aria-label="SteBullX home">
            <Image className="site-footer-logo" src={steBullXLogo} alt="" aria-hidden="true" />
            <span>SteBullX</span>
          </Link>
          <p>Economic stress-testing infrastructure for Stellar DeFi liquidation risk.</p>
          <div className="site-footer-data-note">
            <span className="site-footer-status-dot" aria-hidden="true" />
            <span>DEMO / REPRODUCIBLE BY DEFAULT</span>
          </div>
        </section>

        <nav className="site-footer-links" aria-label="Product navigation">
          <p>EXPLORE</p>
          {productLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>

        <nav className="site-footer-links" aria-label="Resource navigation">
          <p>RESOURCES</p>
          {resourceLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>

        <nav className="site-footer-links" aria-label="External links">
          <p>CONNECT</p>
          {externalLinks.map(([label, href]) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">{label} <span aria-hidden="true">↗</span></a>
          ))}
        </nav>

        <nav className="site-footer-links" aria-label="Legal information">
          <p>LEGAL</p>
          {legalLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
        </nav>
      </div>

      <div className="site-footer-bottom">
        <p>© {new Date().getFullYear()} SteBullX. Built for transparent, reproducible risk research.</p>
        <p>MODELED ESTIMATES · NOT FINANCIAL ADVICE</p>
      </div>
    </footer>
  );
}
