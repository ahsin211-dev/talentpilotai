import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: "TalentPilotAI",
  description: "Secure recruitment marketplace for migration-ready skilled tradespeople."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU">
      <body>
        <header className="site-header">
          <Link className="brand" href="/">
            TalentPilotAI
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/candidate">Candidate</Link>
            <Link href="/employer">Employer</Link>
            <Link href="/admin">Admin</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
