#!/usr/bin/env node
// Generate apple-touch-icon PNGs for /launch.html.
//
// Output: icons/letter/<KEY>-<PALETTE>.png  (180x180)
//   KEY     ∈ A-Z, 0-9        (36 keys)
//   PALETTE ∈ see PALETTES    (8 palettes)
// Total: 288 files. App composes the URL as
//   https://openminis.app/icons/letter/<KEY>-<PALETTE>.png
// and the launcher rewrites <link rel="apple-touch-icon"> from the
// ?icon=<KEY>-<PALETTE> query parameter.
//
// Usage:
//   npm install --no-save @resvg/resvg-js
//   node scripts/gen-icons.mjs

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(__root, 'icons/letter');

// Minis app icon, embedded once as a data URL so every generated PNG
// carries a corner badge marking it as a Minis-managed WebApp.
const BADGE_B64 = readFileSync(resolve(__root, 'icon-180.png')).toString('base64');
const BADGE_HREF = `data:image/png;base64,${BADGE_B64}`;

const KEYS = [
    ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ...'0123456789',
];

const PALETTES = {
    sunset:   ['#FF6B6B', '#FFD93D'],
    ocean:    ['#4FACFE', '#00F2FE'],
    forest:   ['#43E97B', '#38F9D7'],
    grape:    ['#A18CD1', '#FBC2EB'],
    berry:    ['#FA709A', '#FEE140'],
    midnight: ['#30CFD0', '#330867'],
    aurora:   ['#00C9FF', '#92FE9D'],
    peach:    ['#F6D365', '#FDA085'],
};

const SIZE = 180;

// Corner badge geometry: a white circular plate with the Minis app icon
// inset, anchored to the bottom-right with a small margin so it survives
// iOS's apple-touch-icon rounded-rect mask.
const BADGE_D = 72;
const BADGE_MARGIN = 10;
const BADGE_CX = SIZE - BADGE_MARGIN - BADGE_D / 2;
const BADGE_CY = SIZE - BADGE_MARGIN - BADGE_D / 2;
const BADGE_R = BADGE_D / 2;
const LOGO_INSET = 2; // thin white ring around the logo

function svgFor(key, [from, to]) {
    // Shift letter up-left slightly so the bottom-right badge doesn't
    // overlap descenders / serifs of large characters like Q, J, 4.
    const fontSize = key.length === 1 ? 104 : 88;
    const cx = SIZE / 2 - 6;
    const y = key.length === 1 ? 112 : 110;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <clipPath id="badgeClip">
      <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R - LOGO_INSET}"/>
    </clipPath>
    <filter id="badgeShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
      <feOffset dy="1" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" rx="40" fill="url(#g)"/>
  <text x="${cx}" y="${y}"
        font-family="-apple-system, system-ui, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
        font-size="${fontSize}" font-weight="700"
        fill="white" text-anchor="middle"
        letter-spacing="-2">${key}</text>

  <g filter="url(#badgeShadow)">
    <circle cx="${BADGE_CX}" cy="${BADGE_CY}" r="${BADGE_R}" fill="white"/>
    <image href="${BADGE_HREF}"
           x="${BADGE_CX - BADGE_R + LOGO_INSET}"
           y="${BADGE_CY - BADGE_R + LOGO_INSET}"
           width="${BADGE_D - LOGO_INSET * 2}"
           height="${BADGE_D - LOGO_INSET * 2}"
           clip-path="url(#badgeClip)"
           preserveAspectRatio="xMidYMid slice"/>
  </g>
</svg>`;
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const key of KEYS) {
    for (const [palette, stops] of Object.entries(PALETTES)) {
        const svg = svgFor(key, stops);
        const png = new Resvg(svg, {
            fitTo: { mode: 'width', value: SIZE },
            font: { loadSystemFonts: true },
        }).render().asPng();
        const out = resolve(OUT_DIR, `${key}-${palette}.png`);
        writeFileSync(out, png);
        count++;
    }
}

console.log(`Wrote ${count} icons → ${OUT_DIR}`);
