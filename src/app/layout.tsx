import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { AppShell } from "../components/AppShell";
import { getDb } from "../lib/db";
import { getSettings } from "../lib/ops";
import { ensureReady } from "../lib/ready";
import "./globals.css";

const display = Fraunces({ subsets: ["latin"], variable: "--font-display" });
const sans = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SMACKIN’ VIP Ops",
  description: "Community operations for the SMACKIN’ VIP Facebook group.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await ensureReady();
  const settings = await getSettings(await getDb());
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <AppShell mode={settings.mode} paused={settings.publicationPaused}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
