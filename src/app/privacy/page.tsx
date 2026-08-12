import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy | SteBullX",
  description: "How SteBullX handles information collected through its website and APIs.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      label="LEGAL"
      title="Privacy Policy"
      summary="A plain-language explanation of the limited information SteBullX may process when you use the project."
      sections={[
        {
          title: "1. Scope",
          content: <p>This policy explains how SteBullX handles information collected through its website and APIs. It does not apply to third-party services, blockchains, protocols, or websites that we link to; their own privacy notices govern their use of your information.</p>,
        },
        {
          title: "2. Information we may process",
          content: <>
            <p>The current site does not require an account or a user profile. When you visit or make an API request, hosting and security systems may process limited technical information such as your IP address, browser and device details, request time, requested route, referring page, and error or performance data.</p>
            <p>If you contact the project through GitHub or another public channel, we may see the information you choose to share there, such as your username, message, and attachments.</p>
          </>,
        },
        {
          title: "3. How information is used",
          content: <>
            <p>We use technical information only as reasonably necessary to operate, secure, maintain, debug, and improve SteBullX; to understand and respond to abuse; and to comply with applicable legal obligations.</p>
            <p>We do not sell personal information. We do not use personal information for targeted advertising.</p>
          </>,
        },
        {
          title: "4. Sharing and retention",
          content: <>
            <p>Information may be processed by service providers that help host, secure, or operate SteBullX, only for those purposes. We may also disclose information when required to comply with law, protect rights and safety, or investigate misuse of the service.</p>
            <p>We retain information only for as long as reasonably needed for the purposes described above, including security, troubleshooting, and legal compliance. Public contributions to the open-source repository or issue tracker remain subject to the rules and retention practices of those platforms.</p>
          </>,
        },
        {
          title: "5. Your choices",
          content: <p>You can limit information you choose to submit in public project channels. You may also use browser controls to manage cookies and site data. See our <a href="/cookies">Cookies page</a> for the current cookie position. Depending on where you live, you may have rights to request access, correction, deletion, or restriction of personal information; contact us through the project’s GitHub issue tracker to make a request.</p>,
        },
        {
          title: "6. Security and changes",
          content: <>
            <p>We use reasonable measures intended to protect the service, but no internet transmission or storage system is completely secure. Please do not submit sensitive personal, financial, or private key material through SteBullX or public project channels.</p>
            <p>We may revise this policy when the project or its data practices change. The “Last updated” date identifies the current version. Questions can be raised through the project’s <a href="https://github.com/rupamghosh2006/SteBullX/issues" target="_blank" rel="noreferrer">GitHub issue tracker</a>.</p>
          </>,
        },
      ]}
    />
  );
}
