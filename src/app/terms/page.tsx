import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use | SteBullX",
  description: "Terms governing use of the SteBullX website and analytical tools.",
};

export default function TermsPage() {
  return (
    <LegalPage
      label="LEGAL"
      title="Terms of Use"
      summary="The rules for using the SteBullX website, research tools, APIs, and published materials."
      sections={[
        {
          title: "1. Acceptance of these terms",
          content: <p>By accessing or using SteBullX, you agree to these Terms of Use. If you do not agree, do not use the website, APIs, or any related tools. SteBullX is an open-source research project; in these terms, “SteBullX,” “we,” and “us” refer to the project and its contributors.</p>,
        },
        {
          title: "2. Research and informational use only",
          content: <>
            <p>SteBullX provides analytical simulations, modeled estimates, documentation, and related research materials for informational and research purposes. It is not a broker, exchange, investment adviser, custodian, trading venue, oracle, or liquidation service.</p>
            <p>Nothing on SteBullX is financial, investment, legal, tax, or other professional advice. Do not make trading, lending, borrowing, liquidation, or protocol-solvency decisions based solely on a SteBullX result. You are responsible for independently verifying any information and for your own decisions.</p>
          </>,
        },
        {
          title: "3. Model limitations and data quality",
          content: <>
            <p>Results may rely on assumptions, third-party inputs, historical data, or clearly labelled demo and simulated data. They are not predictions or guarantees of future market conditions, liquidation outcomes, protocol safety, or asset value.</p>
            <p>Models can be incomplete, inaccurate, delayed, unavailable, or unsuitable for your use case. Review the project’s <Link href="/docs">documentation</Link> and each report’s provenance, assumptions, and confidence indicators before relying on any output.</p>
          </>,
        },
        {
          title: "4. Acceptable use",
          content: <>
            <p>You may use SteBullX lawfully and in a way that does not interfere with its availability, security, or other users. You must not:</p>
            <ul>
              <li>circumvent access controls, rate limits, or security measures;</li>
              <li>probe, disrupt, overload, or attempt to gain unauthorized access to the site, APIs, or infrastructure;</li>
              <li>misrepresent modeled, demo, or simulated data as live data or investment advice; or</li>
              <li>use SteBullX in violation of applicable law or another person’s rights.</li>
            </ul>
          </>,
        },
        {
          title: "5. Open-source materials and third parties",
          content: <>
            <p>The source code is available under the <a href="https://github.com/rupamghosh2006/SteBullX/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a>. Those license terms apply to the code and documentation in the repository; these Terms govern use of the hosted SteBullX service.</p>
            <p>SteBullX may link to third-party websites, protocols, repositories, or data sources. We do not control or endorse them and are not responsible for their content, availability, security, or practices.</p>
          </>,
        },
        {
          title: "6. Disclaimers and liability",
          content: <>
            <p>SteBullX is provided on an “as is” and “as available” basis, without warranties of any kind, whether express, implied, or statutory. We do not warrant that it will be accurate, complete, secure, uninterrupted, or fit for a particular purpose.</p>
            <p>To the fullest extent permitted by law, SteBullX and its contributors will not be liable for any indirect, incidental, special, consequential, exemplary, or loss-of-profit damages arising from your use of, or inability to use, SteBullX or its outputs.</p>
          </>,
        },
        {
          title: "7. Changes and contact",
          content: <p>We may update these Terms as the project evolves. The “Last updated” date will show when the current version took effect. For questions or to report an issue, use the project’s <a href="https://github.com/rupamghosh2006/SteBullX/issues" target="_blank" rel="noreferrer">GitHub issue tracker</a>.</p>,
        },
      ]}
    />
  );
}
