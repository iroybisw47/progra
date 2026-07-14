import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project. A stray lockfile at
  // C:\Users\iroyb\package-lock.json makes Next infer the wrong workspace
  // root, which was wedging the dev server; this nails it down.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
