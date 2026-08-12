import Link from "next/link";
import type { ReactNode } from "react";

type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalPageProps = {
  label: string;
  title: string;
  summary: string;
  sections: LegalSection[];
};

export function LegalPage({ label, title, summary, sections }: LegalPageProps) {
  return (
    <main className="legal-page">
      <header className="legal-hero">
        <p className="eyebrow">{label}</p>
        <h1>{title}</h1>
        <p className="page-intro">{summary}</p>
        <p className="legal-updated">LAST UPDATED: AUGUST 12, 2026</p>
      </header>

      <div className="legal-layout">
        <aside className="legal-aside" aria-label="Legal navigation">
          <p>RELATED</p>
          <Link href="/terms">Terms of Use</Link>
          <Link href="/privacy">Privacy Policy</Link>
          <Link href="/cookies">Cookies</Link>
        </aside>

        <article className="legal-content">
          {sections.map(({ title: sectionTitle, content }) => (
            <section key={sectionTitle}>
              <h2>{sectionTitle}</h2>
              {content}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
