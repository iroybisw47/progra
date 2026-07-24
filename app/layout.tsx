import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { Toaster } from "@/components/ui/sonner";
import { getActiveSession } from "@/lib/db/sessions";
import { getOptionalUser } from "@/lib/auth/require-user";
import { getProfile } from "@/lib/auth/profile";

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
  description: "Study-time tracker: set goals, clock in, build habits, and track progress with friends.",
  applicationName: "Progra",
  appleWebApp: {
    capable: true,
    title: "Progra",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
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
  // The nav's center Clock button ticks the live worked time when a session is
  // running (V2). All three reads are null-safe when signed out (their own
  // user checks), so they fire in parallel instead of serializing on every
  // page; the auth read inside each is shared via cache(). The profile feeds
  // EnsureProfileSync's stored-timezone comparison (and is free on routes that
  // fetch it anyway).
  const [user, activeSession, profile] = await Promise.all([
    getOptionalUser(),
    getActiveSession(),
    getProfile(),
  ]);
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
        {user && <EnsureProfileSync timezone={profile?.timezone ?? null} />}
        <Toaster />
      </body>
    </html>
  );
}
