import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Progra",
    short_name: "Progra",
    description: "Study-time tracker: set goals, clock in, build habits, and track progress with friends.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    // The brand navy (--brand) — tints the installed app's UI/splash.
    theme_color: "#1c3a5e",
    icons: [
      // The clock mark is full-bleed navy with the glyph inside the maskable
      // safe zone, so the same files serve both "any" and "maskable".
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
