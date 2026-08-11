import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";
import { Topbar } from "@/components/topbar";

export const metadata: Metadata = {
  title: "SteBullX | Stellar DeFi stress testing",
  description: "Stress-test Stellar DeFi before it gets rekt.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Topbar />
        {children}
      </body>
    </html>
  );
}
