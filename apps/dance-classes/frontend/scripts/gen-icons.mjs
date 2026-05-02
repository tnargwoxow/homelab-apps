// One-shot PWA icon generator. Renders the ballet-shoe wordmark SVG to
// 192x192, 512x512, and a 512x512 maskable variant (with safe padding so
// Android can crop it into a circle / squircle without clipping the art).
//
// Run from the apps/dance-classes/frontend directory:
//   node scripts/gen-icons.mjs
//
// Output goes to public/icons/. Commit the resulting PNGs.

import pwPkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pwPkg;
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// Inline SVG that matches BalletShoe.svelte but wrapped in a soft pink card.
function pageHtml({ size, maskable }) {
  // Maskable icons need ~10% safe padding on each side (Android crops up to
  // the inner 80% on round masks). For the standard icon we go full-bleed.
  const padPct = maskable ? 14 : 4;
  const inner = 100 - padPct * 2;
  return `<!doctype html><html><head><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${size}px;height:${size}px;background:transparent}
  .bg{
    width:100%;height:100%;
    background:linear-gradient(135deg,#fbcfe8 0%,#f0abfc 60%,#e9d5ff 100%);
    border-radius:${maskable ? 0 : Math.round(size * 0.18)}px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:inset 0 0 ${Math.round(size * 0.05)}px rgba(255,255,255,.5);
  }
  .art{ width:${inner}%; height:${inner}%; }
</style></head><body>
  <div class="bg">
    <svg class="art" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff5f8"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <path d="M8 38 Q8 28 22 26 Q34 24 48 28 Q56 30 56 38 Q56 46 48 48 Q34 52 22 50 Q8 48 8 38 Z" fill="url(#g)" stroke="#9d174d" stroke-width="1.5"/>
      <ellipse cx="50" cy="38" rx="6" ry="7" fill="#be185d" opacity="0.5"/>
      <path d="M22 26 Q20 18 26 12" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
      <path d="M28 26 Q34 16 42 18" fill="none" stroke="#fb7185" stroke-width="2" stroke-linecap="round"/>
      <g transform="translate(26 14)">
        <ellipse cx="-4" cy="0" rx="4" ry="3" fill="#fb7185" stroke="#9d174d" stroke-width="1"/>
        <ellipse cx="4"  cy="0" rx="4" ry="3" fill="#fb7185" stroke="#9d174d" stroke-width="1"/>
        <circle cx="0"   cy="0" r="1.6" fill="#f43f5e"/>
      </g>
    </svg>
  </div>
</body></html>`;
}

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});

async function render(spec) {
  const ctx = await browser.newContext({ viewport: { width: spec.size, height: spec.size }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(pageHtml({ size: spec.size, maskable: spec.maskable }), { waitUntil: 'load' });
  const out = path.join(OUT, spec.file);
  await page.screenshot({ path: out, type: 'png', omitBackground: true });
  await ctx.close();
  console.log(`wrote ${out}`);
}

await render({ size: 192, file: 'icon-192.png', maskable: false });
await render({ size: 512, file: 'icon-512.png', maskable: false });
await render({ size: 512, file: 'icon-maskable.png', maskable: true });

await browser.close();
console.log('done');
