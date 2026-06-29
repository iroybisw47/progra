import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

import { BottomNav } from "@/components/bottom-nav";
import { EnsureProfileSync } from "@/components/ensure-profile-sync";
import { Toaster } from "@/components/ui/sonner";
import { getOptionalUser } from "@/lib/auth/require-user";

// Hanken Grotesk — all UI text, labels, body, buttons (weights 300–700).
const hankenSans = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Newsreader — serif for headings, hero numbers, goal/recap titles, and the
// warm italic "human" lines. Italic is used for those closing lines.
const newsreaderSerif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
    { media: "(prefers-color-scheme: light)", color: "#F8F6F1" },
    { media: "(prefers-color-scheme: dark)", color: "#22352F" },
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
  return (
    <html
      lang="en"
      className={`${hankenSans.variable} ${newsreaderSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {user && <BottomNav />}
        {user && <EnsureProfileSync />}
        <Toaster />
      </body>
    </html>
  );
}
