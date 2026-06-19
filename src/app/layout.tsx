import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentPilot AI",
  description:
    "Security-first recruitment marketplace for Australian migration and employer workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
