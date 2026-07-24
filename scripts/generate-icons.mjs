// Generates the PWA / favicon PNGs from the Progra clock mark — the same
// navy-square clock used for the in-app logo and loading animation. Full-bleed
// navy (no margin) so iOS/Android home-screen masking rounds it cleanly; the
// clock sits well inside the maskable safe zone. Run: node scripts/generate-icons.mjs

import path from "node:path";
import sharp from "sharp";

const NAVY = "#1c3a5e"; // --brand (light)
const WHITE = "#ffffff";

// The brand mark as SVG (matches components/progra-mark.tsx): navy square,
// white clock ring, hands at 12 & 4. `size` sets the raster resolution so
// sharp rasterizes the vector crisply at each target.
function markSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${NAVY}"/>
  <circle cx="50" cy="50" r="22" fill="none" stroke="${WHITE}" stroke-width="4.5"/>
  <g stroke="${WHITE}" stroke-width="4.5" stroke-linecap="round" fill="none">
    <line x1="50" y1="50" x2="50" y2="38" transform="rotate(120 50 50)"/>
    <line x1="50" y1="50" x2="50" y2="30"/>
  </g>
</svg>`;
}

const targets = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-icon.png", 180], // iOS home screen (opaque, full-bleed)
  ["public/favicon-32.png", 32], // browser tab
];

for (const [rel, size] of targets) {
  const out = path.resolve(rel);
  await sharp(Buffer.from(markSvg(size)))
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`wrote ${rel} (${size}x${size})`);
}
