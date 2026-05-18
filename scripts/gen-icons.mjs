#!/usr/bin/env node
// Generate apple-touch-icon PNGs for /launch.html.
//
// Output: icons/type/<TYPE>-<PALETTE>.png  (180x180)
//   TYPE    ∈ html | markdown | text | pdf | image | video | audio
//   PALETTE ∈ see PALETTES (8 palettes)
// Total: 7 × 8 = 56 files.
//
// The Minis app picks a (type, palette) when creating a Home Screen
// shortcut and embeds it as ?icon=<TYPE>-<PALETTE> in the launcher URL;
// launch.html rewrites <link rel="apple-touch-icon"> + the in-page
// brand icon so Safari "Add to Home Screen" captures the artwork.
//
// Each tile is a gradient rounded square with:
//   - a centered white outline glyph identifying the file type
//   - a bottom-right white-circled Minis app logo badge

import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(__root, 'icons/type');
const LEGACY_DIR = resolve(__root, 'icons/letter');

const BADGE_B64 = readFileSync(resolve(__root, 'icon-180.png')).toString('base64');
const BADGE_HREF = `data:image/png;base64,${BADGE_B64}`;

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

const BADGE_D = 80;
const BADGE_MARGIN = 8;
const BADGE_CX = SIZE - BADGE_MARGIN - BADGE_D / 2;
const BADGE_CY = SIZE - BADGE_MARGIN - BADGE_D / 2;
const BADGE_R = BADGE_D / 2;
const LOGO_INSET = 3;

// Glyph viewBox is 100x100 — every glyph below draws inside this box.
// We then scale + translate it into the tile, centered. The bottom-
// right Minis badge sits on top of the glyph; its drop shadow and
// white fill keep the overlap visually clean.
const GLYPH_SIZE = SIZE * 0.56; // visual size ~56% of tile
const GLYPH_X = (SIZE - GLYPH_SIZE) / 2;
const GLYPH_Y = (SIZE - GLYPH_SIZE) / 2;

// Each glyph is a <g> with shared stroke styling. Inner paths inherit
// stroke-width via the parent <g>; if a path needs a different weight,
// override via stroke-width on that single element. resvg disallows
// duplicate attribute names on the same element, so we keep the
// presentation attributes on the wrapper <g>.
const GLYPHS = {
    // <> code brackets + slash
    html: `
        <path d="M35 30 L15 50 L35 70"/>
        <path d="M65 30 L85 50 L65 70"/>
        <path d="M58 22 L42 78"/>`,
    // Document with literal "MD" letterforms
    markdown: `
        <path d="M22 18 H62 L78 34 V82 H22 Z"/>
        <path d="M62 18 V34 H78"/>
        <text x="50" y="70" fill="white" stroke="none"
              font-family="-apple-system, system-ui, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
              font-size="22" font-weight="800" text-anchor="middle"
              letter-spacing="-0.5">MD</text>`,
    // Three horizontal lines (text doc)
    text: `
        <path d="M22 18 H62 L78 34 V82 H22 Z"/>
        <path d="M62 18 V34 H78"/>
        <path d="M32 48 H66"/>
        <path d="M32 60 H66"/>
        <path d="M32 72 H54"/>`,
    // PDF doc — render the literal text "PDF" with a bold sans-serif
    pdf: `
        <path d="M22 18 H62 L78 34 V82 H22 Z"/>
        <path d="M62 18 V34 H78"/>
        <text x="50" y="70" fill="white" stroke="none"
              font-family="-apple-system, system-ui, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"
              font-size="22" font-weight="800" text-anchor="middle"
              letter-spacing="-0.5">PDF</text>`,
    // Mountain + sun in a frame
    image: `
        <rect x="14" y="20" width="72" height="60" rx="6"/>
        <circle cx="32" cy="38" r="6"/>
        <path d="M14 70 L38 48 L56 64 L70 54 L86 70"/>`,
    // Play triangle in a frame
    video: `
        <rect x="14" y="22" width="72" height="56" rx="8"/>
        <path d="M44 36 L66 50 L44 64 Z"/>`,
    // Music note with two filled note heads
    audio: `
        <path d="M40 70 V32 L72 24 V62"/>
        <ellipse cx="34" cy="72" rx="8" ry="6"/>
        <ellipse cx="66" cy="64" rx="8" ry="6"/>`,
};

const GLYPH_STROKE = `stroke="white" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"`;

function svgFor(type, [from, to]) {
    const glyph = GLYPHS[type];
    if (!glyph) throw new Error(`Unknown glyph type: ${type}`);
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
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/>
      <feOffset dy="1" result="off"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.4"/></feComponentTransfer>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <rect width="${SIZE}" height="${SIZE}" rx="40" fill="url(#g)"/>

  <g transform="translate(${GLYPH_X} ${GLYPH_Y}) scale(${GLYPH_SIZE / 100})" ${GLYPH_STROKE}>
    ${glyph}
  </g>

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

// Wipe legacy letter-based output so the served set matches the spec.
if (existsSync(LEGACY_DIR)) {
    rmSync(LEGACY_DIR, { recursive: true, force: true });
    console.log(`Removed legacy ${LEGACY_DIR}`);
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const type of Object.keys(GLYPHS)) {
    for (const [palette, stops] of Object.entries(PALETTES)) {
        const svg = svgFor(type, stops);
        const png = new Resvg(svg, {
            fitTo: { mode: 'width', value: SIZE },
            font: { loadSystemFonts: true },
        }).render().asPng();
        const out = resolve(OUT_DIR, `${type}-${palette}.png`);
        writeFileSync(out, png);
        count++;
    }
}

console.log(`Wrote ${count} icons → ${OUT_DIR}`);
