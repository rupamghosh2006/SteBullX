import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookies | SteBullX",
  description: "The current cookie practices for SteBullX.",
};

export default function CookiesPage() {
  return (
    <LegalPage
      label="LEGAL"
      title="Cookies"
      summary="The current SteBullX application does not use advertising, analytics, or preference cookies."
      sections={[
        {
          title: "1. What cookies are",
          content: <p>Cookies are small text files that a website can store in your browser. Similar technologies, such as local storage and pixels, can also remember information or help measure activity.</p>,
        },
        {
          title: "2. Our current use",
          content: <>
            <p>The current SteBullX application does not set advertising, analytics, social-media, or preference cookies. It does not use browser local storage or session storage to track visitors.</p>
            <p>If we introduce optional analytics, personalization, or another non-essential storage technology, we will update this page and, where required, request consent before it is used.</p>
          </>,
        },
        {
          title: "3. Essential service processing",
          content: <p>Hosting and security providers may process technical request information, such as IP addresses and request logs, to deliver and protect the service. This processing does not mean SteBullX sets a tracking cookie. See our <a href="/privacy">Privacy Policy</a> for more detail.</p>,
        },
        {
          title: "4. Managing cookies",
          content: <p>You can control cookies and other site data through your browser settings. Since SteBullX does not currently rely on non-essential cookies, changing these settings should not affect the core site experience. Third-party sites you visit from SteBullX may have their own cookie practices and controls.</p>,
        },
        {
          title: "5. Changes and questions",
          content: <p>We will revise this page if our use of cookies or similar technologies changes. For questions, use the project’s <a href="https://github.com/rupamghosh2006/SteBullX/issues" target="_blank" rel="noreferrer">GitHub issue tracker</a>.</p>,
        },
      ]}
    />
  );
}
