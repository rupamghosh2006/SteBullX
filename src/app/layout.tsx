import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import { SiteFooter } from "@/components/footer";
import { Topbar } from "@/components/topbar";
import steBullXLogo from "../../Public/logo.png";

export const metadata: Metadata = {
  title: "SteBullX | Stellar DeFi stress testing",
  description: "Stress-test Stellar DeFi before it gets rekt.",
  icons: {
    icon: [{ url: steBullXLogo.src, type: "image/png", sizes: "1254x1254" }],
    apple: [{ url: steBullXLogo.src, type: "image/png", sizes: "1254x1254" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Topbar />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
