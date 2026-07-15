import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { Toaster } from "@/components/ui/sonner";
import { getActiveSession } from "@/lib/db/sessions";
import { getOptionalUser } from "@/lib/auth/require-user";

// PT Sans everywhere (Progra V2). One family for both body and headings; the
// serif/heading slot (--font-newsreader) is aliased to --font-hanken in
// globals.css. PT Sans ships 400/700 (+ italic 400); 500/600 utilities fall back
// to the nearest weight, matching the V2 prototype.
const ptSans = PT_Sans({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Progra",
  description: "Personal productivity: weekly planning, deep-work clock-in, habits, and a Sunday recap.",
  applicationName: "Progra",
  appleWebApp: {
    capable: true,
    title: "Progra",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14181f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getOptionalUser();
  // The nav's center Clock button ticks the live worked time when a session is
  // running (V2). Only fetched when signed in (the nav renders only then).
  const activeSession = user ? await getActiveSession() : null;
  return (
    <html lang="en" className={`${ptSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {user && (
          <BottomNav
            activeSession={
              activeSession
                ? {
                    startedAt: activeSession.startedAt,
                    endedAt: activeSession.endedAt,
                    pausedMs: activeSession.pausedMs,
                    pausedSince: activeSession.pausedSince,
                  }
                : null
            }
          />
        )}
        {user && <EnsureProfileSync />}
        <Toaster />
      </body>
    </html>
  );
}
