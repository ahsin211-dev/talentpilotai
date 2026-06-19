import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentPilotAI — Skilled Trades Recruitment Marketplace",
  description:
    "Privacy-first marketplace connecting overseas skilled tradespeople with Australian employers, with AI document processing and visa case management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
