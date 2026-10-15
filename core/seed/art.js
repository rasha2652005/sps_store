// Generic product illustrations (SVG) used as placeholder photos for the demo catalog.
// They are original, brand-free drawings; the shop replaces them with real photos from the admin panel.
import { colorFamily } from '../catalog.js';

const W = 800;

// ---------- color helpers ----------
const hexToRgb = (h) => {
  const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbToHex = (c) => '#' + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.map((x, i) => x + (B[i] - x) * t));
};
const lighten = (c, t) => mix(c, '#ffffff', t);
const darken = (c, t) => mix(c, '#000000', t);
const lum = (h) => {
  const [r, g, b] = hexToRgb(h).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const WALLPAPERS = {
  black: ['#0f0c29', '#3b2f8f', '#9d7bff'],
  white: ['#0b3d91', '#3fa9f5', '#d6f3ff'],
  silver: ['#132b5c', '#5b8def', '#dbe8ff'],
  gray: ['#111827', '#4f46e5', '#b4bcff'],
  blue: ['#061a40', '#1f6fd1', '#bfe0ff'],
  green: ['#06301d', '#1e8a5a', '#c4f5dc'],
  purple: ['#25073f', '#8b5cf6', '#ecdcff'],
  pink: ['#470b2b', '#e64694', '#ffd3e8'],
  red: ['#3b0a0a', '#e11d48', '#ffd0d8'],
  orange: ['#3a1002', '#f2701d', '#ffdcb8'],
  gold: ['#3b2a06', '#c99a2e', '#fff1c9'],
};
const wallFor = (hex) => WALLPAPERS[colorFamily(hex) || 'black'] || WALLPAPERS.black;

// ---------- svg plumbing ----------
function svg(defs, body, { bg = null } = {}) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">` +
    `<defs>${SHARED_DEFS}${defs}</defs>` +
    (bg ? `<rect width="${W}" height="${W}" fill="${bg}"/>` : '') +
    body +
    `</svg>`
  );
}

const SHARED_DEFS =
  `<filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>` +
  `<filter id="blur40" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>` +
  `<filter id="drop" x="-30%" y="-20%" width="160%" height="150%"><feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#000" flood-opacity="0.22"/></filter>` +
  `<radialGradient id="lensGlass" cx="0.45" cy="0.4" r="0.65"><stop offset="0" stop-color="#3a4d8f"/><stop offset="0.45" stop-color="#151b38"/><stop offset="1" stop-color="#05060c"/></radialGradient>` +
  `<linearGradient id="lensRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d8f99"/><stop offset="0.5" stop-color="#2b2c31"/><stop offset="1" stop-color="#a5a7b0"/></linearGradient>` +
  `<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f6"/><stop offset="0.5" stop-color="#a9abb3"/><stop offset="1" stop-color="#e6e7ea"/></linearGradient>`;

let seq = 0;
const uid = (p) => `${p}${++seq}`;

const ground = (cx = 400, cy = 712, rx = 250, ry = 24, op = 0.18) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#000" opacity="${op}" filter="url(#soft)"/>`;

function lens(cx, cy, r) {
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#lensRing)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.8}" fill="#0c0d12"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.66}" fill="url(#lensGlass)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="#04050a"/>` +
    `<ellipse cx="${cx - r * 0.24}" cy="${cy - r * 0.26}" rx="${r * 0.2}" ry="${r * 0.12}" fill="#fff" opacity="0.35" transform="rotate(-35 ${cx - r * 0.24} ${cy - r * 0.26})"/>` +
    `<circle cx="${cx + r * 0.2}" cy="${cy + r * 0.18}" r="${r * 0.07}" fill="#9fc0ff" opacity="0.55"/>`
  );
}
const flash = (cx, cy, r) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f4efe1" stroke="#c9c2ad" stroke-width="${r * 0.18}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#fffaf0"/>`;

// ---------- phones ----------
function cameraModule(style, x, y, w, h, color) {
  const plate = (px, py, pw, ph, pr) => {
    const id = uid('cm');
    const top = lum(color) > 0.55 ? darken(color, 0.06) : lighten(color, 0.1);
    return (
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(top, 0.12)}"/><stop offset="1" stop-color="${darken(top, 0.08)}"/></linearGradient></defs>` +
      `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${pr}" fill="${darken(color, 0.25)}" opacity="0.35" transform="translate(2 4)"/>` +
      `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${pr}" fill="url(#${id})" stroke="${darken(color, 0.18)}" stroke-opacity="0.35" stroke-width="2"/>`
    );
  };
  switch (style) {
    case 'square3': {
      const s = w * 0.5;
      const px = x + w * 0.075;
      const py = y + h * 0.035;
      const r = s * 0.2;
      return (
        plate(px, py, s, s, s * 0.24) +
        lens(px + s * 0.3, py + s * 0.28, r) +
        lens(px + s * 0.3, py + s * 0.72, r) +
        lens(px + s * 0.73, py + s * 0.5, r) +
        flash(px + s * 0.74, py + s * 0.18, s * 0.065) +
        `<circle cx="${px + s * 0.74}" cy="${py + s * 0.83}" r="${s * 0.035}" fill="#1b1c22"/>`
      );
    }
    case 'bar': {
      const py = y + h * 0.11;
      const bh = h * 0.1;
      return (
        `<rect x="${x + 6}" y="${py}" width="${w - 12}" height="${bh}" rx="${bh / 2}" fill="${darken(color, 0.5)}"/>` +
        `<rect x="${x + 6}" y="${py}" width="${w - 12}" height="${bh * 0.5}" rx="${bh / 4}" fill="#fff" opacity="0.08"/>` +
        lens(x + w * 0.22, py + bh / 2, bh * 0.36) +
        lens(x + w * 0.42, py + bh / 2, bh * 0.36) +
        lens(x + w * 0.62, py + bh / 2, bh * 0.3) +
        flash(x + w * 0.82, py + bh / 2, bh * 0.14)
      );
    }
    case 'duo': {
      const pw = w * 0.22;
      const px = x + w * 0.1;
      const py = y + h * 0.04;
      const ph = h * 0.24;
      return (
        plate(px, py, pw, ph, pw / 2) +
        lens(px + pw / 2, py + pw * 0.55, pw * 0.38) +
        lens(px + pw / 2, py + ph - pw * 0.55, pw * 0.38) +
        flash(x + w * 0.42, y + h * 0.07, w * 0.035)
      );
    }
    case 'column': {
      const cx = x + w * 0.2;
      const r = w * 0.085;
      return lens(cx, y + h * 0.075, r) + lens(cx, y + h * 0.16, r) + lens(cx, y + h * 0.245, r) + flash(x + w * 0.38, y + h * 0.075, w * 0.03);
    }
    case 'quad': {
      const s = w * 0.48;
      const px = x + w * 0.08;
      const py = y + h * 0.035;
      const r = s * 0.17;
      return (
        plate(px, py, s, s, s * 0.2) +
        lens(px + s * 0.29, py + s * 0.29, r) +
        lens(px + s * 0.71, py + s * 0.29, r) +
        lens(px + s * 0.29, py + s * 0.71, r) +
        lens(px + s * 0.71, py + s * 0.71, r * 0.75) +
        flash(px + s * 0.5, py + s * 0.5, s * 0.05)
      );
    }
    case 'circle': {
      const cx = x + w / 2;
      const cy = y + h * 0.17;
      const R = w * 0.27;
      const id = uid('cc');
      return (
        `<defs><radialGradient id="${id}" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="#3a3b42"/><stop offset="1" stop-color="#121216"/></radialGradient></defs>` +
        `<circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="url(#metal)"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id})"/>` +
        lens(cx - R * 0.42, cy - R * 0.38, R * 0.3) +
        lens(cx + R * 0.42, cy - R * 0.38, R * 0.3) +
        lens(cx - R * 0.42, cy + R * 0.4, R * 0.3) +
        flash(cx + R * 0.42, cy + R * 0.42, R * 0.12)
      );
    }
    case 'air': {
      const py = y + h * 0.03;
      const bh = h * 0.12;
      return (
        `<rect x="${x + 8}" y="${py}" width="${w - 16}" height="${bh}" rx="${bh * 0.45}" fill="${lum(color) > 0.6 ? darken(color, 0.08) : lighten(color, 0.12)}" stroke="${darken(color, 0.2)}" stroke-opacity="0.3" stroke-width="2"/>` +
        lens(x + w * 0.2, py + bh / 2, bh * 0.34) +
        flash(x + w * 0.38, py + bh / 2, bh * 0.1) +
        `<circle cx="${x + w * 0.8}" cy="${py + bh / 2}" r="${bh * 0.06}" fill="#1b1c22"/>`
      );
    }
    default: {
      // single
      return lens(x + w * 0.22, y + h * 0.09, w * 0.1) + flash(x + w * 0.22, y + h * 0.17, w * 0.035);
    }
  }
}

function phoneBack({ x, y, w, h, color, cam, rot = 0 }) {
  const id = uid('pb');
  const r = w * 0.16;
  const light = lighten(color, 0.22);
  const dark = darken(color, 0.18);
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    `<defs>` +
    `<linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="0.55" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>` +
    `<linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${darken(color, 0.3)}"/><stop offset="0.12" stop-color="${lighten(color, 0.35)}"/><stop offset="0.88" stop-color="${lighten(color, 0.25)}"/><stop offset="1" stop-color="${darken(color, 0.35)}"/></linearGradient>` +
    `<radialGradient id="${id}s" cx="0.2" cy="0.08" r="0.75"><stop offset="0" stop-color="#fff" stop-opacity="0.38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<g transform="rotate(${rot} ${cx} ${cy})" filter="url(#drop)">` +
    `<rect x="${x - 3}" y="${y + h * 0.2}" width="6" height="${h * 0.07}" rx="3" fill="${dark}"/>` +
    `<rect x="${x - 3}" y="${y + h * 0.3}" width="6" height="${h * 0.1}" rx="3" fill="${dark}"/>` +
    `<rect x="${x + w - 3}" y="${y + h * 0.26}" width="6" height="${h * 0.13}" rx="3" fill="${dark}"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${id}e)"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="${r - 5}" fill="url(#${id}b)"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="${r - 5}" fill="url(#${id}s)"/>` +
    `<path d="M${x + w * 0.62} ${y + 5} L${x + w - 5} ${y + 5} L${x + w - 5} ${y + h * 0.42} Z" fill="#fff" opacity="0.06"/>` +
    cameraModule(cam, x, y, w, h, color) +
    `</g>`
  );
}

function screenContent(id, x, y, w, h, r, wall) {
  const [a, b, c] = wall;
  const ix = x;
  const iy = y;
  return (
    `<defs>` +
    `<linearGradient id="${id}w" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${b}"/><stop offset="0.6" stop-color="${a}"/><stop offset="1" stop-color="${darken(a, 0.3)}"/></linearGradient>` +
    `<clipPath id="${id}c"><rect x="${ix}" y="${iy}" width="${w}" height="${h}" rx="${r}"/></clipPath>` +
    `</defs>` +
    `<g clip-path="url(#${id}c)">` +
    `<rect x="${ix}" y="${iy}" width="${w}" height="${h}" fill="url(#${id}w)"/>` +
    `<circle cx="${ix + w * 0.85}" cy="${iy + h * 0.28}" r="${w * 0.55}" fill="${c}" opacity="0.55" filter="url(#blur40)"/>` +
    `<circle cx="${ix + w * 0.1}" cy="${iy + h * 0.62}" r="${w * 0.5}" fill="${b}" opacity="0.7" filter="url(#blur40)"/>` +
    `<path d="M${ix} ${iy + h * 0.55} C ${ix + w * 0.35} ${iy + h * 0.42}, ${ix + w * 0.6} ${iy + h * 0.75}, ${ix + w} ${iy + h * 0.6} L ${ix + w} ${iy + h} L ${ix} ${iy + h} Z" fill="${a}" opacity="0.55"/>` +
    // simple widgets / dock (generic, no OS imitation)
    `<rect x="${ix + w * 0.08}" y="${iy + h * 0.12}" width="${w * 0.4}" height="${w * 0.4}" rx="${w * 0.08}" fill="#fff" opacity="0.16"/>` +
    `<rect x="${ix + w * 0.52}" y="${iy + h * 0.12}" width="${w * 0.4}" height="${w * 0.4}" rx="${w * 0.08}" fill="#fff" opacity="0.1"/>` +
    [0, 1, 2, 3]
      .map((i) => `<rect x="${ix + w * (0.09 + i * 0.215)}" y="${iy + h * 0.86}" width="${w * 0.17}" height="${w * 0.17}" rx="${w * 0.05}" fill="#fff" opacity="0.22"/>`)
      .join('') +
    `<rect x="${ix + w * 0.06}" y="${iy + h * 0.835}" width="${w * 0.88}" height="${w * 0.25}" rx="${w * 0.09}" fill="#fff" opacity="0.08"/>` +
    `<path d="M${ix} ${iy} L${ix + w * 0.5} ${iy} L${ix} ${iy + h * 0.45} Z" fill="#fff" opacity="0.07"/>` +
    `</g>`
  );
}

function phoneFront({ x, y, w, h, color, wall, rot = 0 }) {
  const id = uid('pf');
  const r = w * 0.16;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inset = w * 0.045;
  return (
    `<defs><linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${darken(color, 0.25)}"/><stop offset="0.1" stop-color="${lighten(color, 0.3)}"/><stop offset="0.9" stop-color="${lighten(color, 0.2)}"/><stop offset="1" stop-color="${darken(color, 0.3)}"/></linearGradient></defs>` +
    `<g transform="rotate(${rot} ${cx} ${cy})" filter="url(#drop)">` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${id}e)"/>` +
    `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="${h - 8}" rx="${r - 4}" fill="#050507"/>` +
    screenContent(id, x + inset, y + inset, w - inset * 2, h - inset * 2, r - inset, wall) +
    `<circle cx="${cx}" cy="${y + inset + w * 0.06}" r="${w * 0.028}" fill="#000"/>` +
    `<circle cx="${cx}" cy="${y + inset + w * 0.06}" r="${w * 0.012}" fill="#1d2440"/>` +
    `</g>`
  );
}

export function phoneArt({ color, cam = 'square3', view = 'pair' }) {
  const wall = wallFor(color);
  if (view === 'back') {
    return svg('', ground(400, 720, 200, 22) + phoneBack({ x: 255, y: 90, w: 290, h: 600, color, cam, rot: -9 }));
  }
  return svg(
    '',
    ground(400, 716, 280, 26) +
      phoneFront({ x: 150, y: 140, w: 262, h: 545, color, wall, rot: -7 }) +
      phoneBack({ x: 370, y: 104, w: 275, h: 572, color, cam, rot: 7 }),
  );
}

export function foldArt({ color }) {
  // Flip-style phone: closed with cover screen + open front
  const wall = wallFor(color);
  const id = uid('fl');
  const body =
    ground(400, 716, 280, 26) +
    phoneFront({ x: 150, y: 120, w: 255, h: 590, color, wall, rot: -6 }) +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.2)}"/><stop offset="1" stop-color="${darken(color, 0.2)}"/></linearGradient></defs>` +
    `<g transform="rotate(8 520 450)" filter="url(#drop)">` +
    `<rect x="390" y="300" width="270" height="300" rx="44" fill="url(#${id})"/>` +
    `<rect x="402" y="312" width="246" height="150" rx="34" fill="#07070a"/>` +
    screenContent(id + 'x', 410, 320, 230, 134, 28, wall) +
    lens(450, 362, 22) +
    lens(510, 362, 22) +
    `<rect x="390" y="470" width="270" height="6" fill="${darken(color, 0.35)}" opacity="0.6"/>` +
    `</g>`;
  return svg('', body);
}

// ---------- tablets ----------
export function tabletArt({ color }) {
  const wall = wallFor(color);
  const id = uid('tb');
  const x = 110;
  const y = 200;
  const w = 580;
  const h = 400;
  return svg(
    `<linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.3)}"/><stop offset="1" stop-color="${darken(color, 0.25)}"/></linearGradient>`,
    ground(400, 690, 300, 24) +
      `<g transform="rotate(-5 400 400)" filter="url(#drop)">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="34" fill="url(#${id}e)"/>` +
      `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="30" fill="#050507"/>` +
      screenContent(id, x + 22, y + 22, w - 44, h - 44, 16, wall) +
      `<circle cx="${x + w / 2}" cy="${y + 13}" r="4" fill="#1d2440"/>` +
      `</g>`,
  );
}

// ---------- wearables ----------
export function watchArt({ color, band, shape = 'square' }) {
  const id = uid('wt');
  const bandColor = band || darken(color, 0.1);
  const metalA = lighten(color, 0.35);
  const metalB = darken(color, 0.25);
  const strap = (y1, y2) =>
    `<rect x="318" y="${y1}" width="164" height="${y2 - y1}" rx="34" fill="url(#${id}band)"/>` +
    [0, 1, 2, 3, 4].map((i) => `<rect x="330" y="${y1 + 20 + i * ((y2 - y1 - 40) / 5)}" width="140" height="3" rx="1.5" fill="#000" opacity="0.08"/>`).join('');
  const face =
    shape === 'round'
      ? `<circle cx="400" cy="400" r="150" fill="url(#${id}case)"/><circle cx="400" cy="400" r="138" fill="${darken(color, 0.4)}"/><circle cx="400" cy="400" r="126" fill="#030304"/>`
      : `<rect x="262" y="235" width="276" height="330" rx="84" fill="url(#${id}case)"/><rect x="276" y="249" width="248" height="302" rx="72" fill="#030304"/>`;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r1 = i % 3 === 0 ? 92 : 100;
    return `<line x1="${400 + Math.sin(a) * r1}" y1="${400 - Math.cos(a) * r1}" x2="${400 + Math.sin(a) * 108}" y2="${400 - Math.cos(a) * 108}" stroke="#fff" stroke-width="${i % 3 === 0 ? 5 : 3}" stroke-linecap="round" opacity="${i % 3 === 0 ? 0.95 : 0.55}"/>`;
  }).join('');
  return svg(
    `<linearGradient id="${id}case" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${metalA}"/><stop offset="0.5" stop-color="${color}"/><stop offset="1" stop-color="${metalB}"/></linearGradient>` +
      `<linearGradient id="${id}band" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${darken(bandColor, 0.15)}"/><stop offset="0.5" stop-color="${bandColor}"/><stop offset="1" stop-color="${darken(bandColor, 0.2)}"/></linearGradient>` +
      `<radialGradient id="${id}glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3a7bd5" stop-opacity="0.35"/><stop offset="1" stop-color="#3a7bd5" stop-opacity="0"/></radialGradient>`,
    ground(400, 760, 140, 18, 0.14) +
      `<g filter="url(#drop)">` +
      strap(40, 300) +
      strap(500, 760) +
      `<rect x="532" y="330" width="20" height="56" rx="8" fill="url(#${id}case)"/>` +
      `<rect x="534" y="405" width="12" height="70" rx="6" fill="${metalB}"/>` +
      face +
      `<circle cx="400" cy="400" r="112" fill="url(#${id}glow)"/>` +
      ticks +
      `<line x1="400" y1="400" x2="448" y2="356" stroke="#fff" stroke-width="7" stroke-linecap="round"/>` +
      `<line x1="400" y1="400" x2="392" y2="318" stroke="#fff" stroke-width="5" stroke-linecap="round"/>` +
      `<line x1="400" y1="412" x2="400" y2="306" stroke="#ff6a2b" stroke-width="2.5" stroke-linecap="round"/>` +
      `<circle cx="400" cy="400" r="7" fill="#fff"/><circle cx="400" cy="400" r="3" fill="#ff6a2b"/>` +
      `</g>`,
  );
}

export function budsArt({ color = '#f4f4f6', style = 'stem' }) {
  const id = uid('bd');
  const dark = darken(color, 0.12);
  const isLight = lum(color) > 0.55;
  const bud = (cx, cy, flip) => {
    const s = flip ? -1 : 1;
    if (style === 'bean') {
      return (
        `<g transform="translate(${cx} ${cy}) scale(${s} 1) rotate(-18)">` +
        `<ellipse cx="0" cy="0" rx="62" ry="50" fill="url(#${id}c)"/>` +
        `<ellipse cx="-14" cy="-14" rx="30" ry="16" fill="#fff" opacity="0.35"/>` +
        `<ellipse cx="44" cy="18" rx="26" ry="22" fill="${isLight ? '#d9dae0' : '#2a2b30'}"/>` +
        `<ellipse cx="48" cy="20" rx="15" ry="13" fill="${isLight ? '#bfc1c9' : '#141418'}"/>` +
        `</g>`
      );
    }
    return (
      `<g transform="translate(${cx} ${cy}) scale(${s} 1) rotate(-14)">` +
      `<rect x="-17" y="10" width="34" height="132" rx="17" fill="url(#${id}c)"/>` +
      `<circle cx="0" cy="0" r="54" fill="url(#${id}c)"/>` +
      `<ellipse cx="34" cy="10" rx="24" ry="28" fill="${isLight ? '#dfe0e6' : '#2a2b30'}"/>` +
      `<ellipse cx="38" cy="12" rx="13" ry="16" fill="${isLight ? '#c4c6ce' : '#141418'}"/>` +
      `<ellipse cx="-14" cy="-18" rx="20" ry="12" fill="#fff" opacity="0.45"/>` +
      `<rect x="-6" y="128" width="12" height="8" rx="3" fill="#b9bbc3"/>` +
      `</g>`
    );
  };
  return svg(
    `<linearGradient id="${id}c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.4)}"/><stop offset="0.6" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>`,
    ground(400, 690, 250, 22) +
      `<g filter="url(#drop)">` +
      `<rect x="245" y="360" width="310" height="245" rx="104" fill="url(#${id}c)"/>` +
      `<path d="M245 440 L555 440" stroke="${darken(color, 0.22)}" stroke-width="3" opacity="0.6"/>` +
      `<ellipse cx="360" cy="400" rx="80" ry="24" fill="#fff" opacity="0.28"/>` +
      `<circle cx="400" cy="500" r="7" fill="#34d399"/>` +
      `<circle cx="400" cy="500" r="13" fill="#34d399" opacity="0.25"/>` +
      bud(320, 230, false) +
      bud(480, 230, true) +
      `</g>`,
  );
}

// ---------- charging ----------
export function chargerArt({ color = '#f5f5f7', ports = 3 }) {
  const id = uid('ch');
  const isLight = lum(color) > 0.5;
  const front = isLight ? ['#ffffff', '#e4e5ea'] : [lighten(color, 0.12), darken(color, 0.15)];
  const top = isLight ? '#f7f7f9' : lighten(color, 0.2);
  const side = isLight ? '#d4d5dc' : darken(color, 0.3);
  const slots = Array.from({ length: ports }, (_, i) => {
    const y = 400 + (i - (ports - 1) / 2) * 62 + 40;
    return (
      `<rect x="345" y="${y - 12}" width="110" height="26" rx="13" fill="${isLight ? '#2b2c31' : '#050506'}"/>` +
      `<rect x="362" y="${y - 3}" width="76" height="8" rx="4" fill="${isLight ? '#5d5f68' : '#33343a'}"/>`
    );
  }).join('');
  return svg(
    `<linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${front[0]}"/><stop offset="1" stop-color="${front[1]}"/></linearGradient>`,
    ground(430, 690, 210, 22) +
      `<g filter="url(#drop)">` +
      `<rect x="372" y="150" width="24" height="120" rx="12" fill="url(#metal)"/>` +
      `<rect x="452" y="140" width="24" height="120" rx="12" fill="url(#metal)"/>` +
      `<path d="M285 265 L515 265 L575 220 L345 220 Z" fill="${top}" stroke="${top}" stroke-width="26" stroke-linejoin="round"/>` +
      `<path d="M515 265 L575 220 L575 560 L515 615 Z" fill="${side}" stroke="${side}" stroke-width="26" stroke-linejoin="round"/>` +
      `<rect x="272" y="252" width="256" height="376" rx="34" fill="url(#${id}f)"/>` +
      `<rect x="282" y="262" width="236" height="40" rx="20" fill="#fff" opacity="${isLight ? 0.6 : 0.08}"/>` +
      slots +
      `</g>`,
  );
}

export function cableArt({ color = '#f2f2f4', ends = 'cc' }) {
  const path = 'M178 560 C 110 430, 190 250, 360 285 C 540 322, 590 470, 455 525 C 320 580, 250 430, 380 375 C 515 318, 640 380, 615 560';
  const plug = (x, y, rot, kind) =>
    `<g transform="translate(${x} ${y}) rotate(${rot})">` +
    `<rect x="-26" y="-20" width="52" height="96" rx="16" fill="${lum(color) > 0.5 ? '#f7f7f9' : darken(color, 0.1)}" stroke="#000" stroke-opacity="0.08"/>` +
    `<rect x="-26" y="-20" width="20" height="96" rx="10" fill="#fff" opacity="0.35"/>` +
    (kind === 'l'
      ? `<rect x="-11" y="-74" width="22" height="58" rx="6" fill="url(#metal)"/>`
      : `<rect x="-19" y="-66" width="38" height="50" rx="14" fill="url(#metal)"/><rect x="-11" y="-56" width="22" height="10" rx="5" fill="#45464d"/>`) +
    `</g>`;
  return svg(
    '',
    ground(400, 690, 260, 20, 0.14) +
      `<g filter="url(#drop)">` +
      `<path d="${path}" fill="none" stroke="${darken(color, 0.12)}" stroke-width="22" stroke-linecap="round"/>` +
      `<path d="${path}" fill="none" stroke="${color}" stroke-width="18" stroke-linecap="round"/>` +
      `<path d="${path}" fill="none" stroke="#000" stroke-opacity="0.13" stroke-width="18" stroke-dasharray="3 7" stroke-linecap="butt"/>` +
      `<path d="${path}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="5" transform="translate(-2 -4)" stroke-linecap="round"/>` +
      plug(178, 600, 170, 'c') +
      plug(615, 600, 190, ends === 'cl' ? 'l' : 'c') +
      `</g>`,
  );
}

export function powerbankArt({ color = '#f4f4f6', magnetic = true }) {
  const id = uid('pk');
  const isLight = lum(color) > 0.55;
  return svg(
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.3)}"/><stop offset="0.6" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.18)}"/></linearGradient>`,
    ground(400, 700, 190, 20) +
      `<g filter="url(#drop)" transform="rotate(-6 400 400)">` +
      `<rect x="262" y="150" width="276" height="480" rx="54" fill="${darken(color, 0.2)}"/>` +
      `<rect x="266" y="152" width="268" height="472" rx="51" fill="url(#${id})"/>` +
      `<ellipse cx="340" cy="210" rx="70" ry="30" fill="#fff" opacity="0.25"/>` +
      (magnetic
        ? `<circle cx="400" cy="360" r="104" fill="none" stroke="${isLight ? '#000' : '#fff'}" stroke-opacity="0.12" stroke-width="10"/><circle cx="400" cy="360" r="74" fill="none" stroke="${isLight ? '#000' : '#fff'}" stroke-opacity="0.07" stroke-width="3"/>`
        : `<rect x="300" y="300" width="200" height="110" rx="20" fill="${isLight ? '#000' : '#fff'}" opacity="0.06"/>`) +
      [0, 1, 2, 3].map((i) => `<circle cx="${358 + i * 28}" cy="560" r="7" fill="${i < 3 ? '#34d399' : isLight ? '#c9cad1' : '#3a3b40'}"/>`).join('') +
      `<rect x="372" y="618" width="56" height="10" rx="5" fill="#1d1e22"/>` +
      `</g>`,
  );
}

export function padArt({ color = '#f2f2f4' }) {
  const id = uid('pd');
  return svg(
    `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.8"><stop offset="0" stop-color="${lighten(color, 0.4)}"/><stop offset="1" stop-color="${darken(color, 0.12)}"/></radialGradient>`,
    ground(400, 600, 240, 26) +
      `<path d="M590 470 C 680 520, 700 610, 640 690" fill="none" stroke="${darken(color, 0.15)}" stroke-width="16" stroke-linecap="round"/>` +
      `<g filter="url(#drop)">` +
      `<ellipse cx="400" cy="470" rx="215" ry="122" fill="${darken(color, 0.25)}"/>` +
      `<ellipse cx="400" cy="450" rx="215" ry="122" fill="url(#${id})"/>` +
      `<ellipse cx="400" cy="450" rx="120" ry="66" fill="none" stroke="${darken(color, 0.2)}" stroke-opacity="0.5" stroke-width="5"/>` +
      `<ellipse cx="340" cy="405" rx="90" ry="26" fill="#fff" opacity="0.35"/>` +
      `<circle cx="400" cy="548" r="5" fill="#34d399"/>` +
      `</g>`,
  );
}

export function standArt({ color = '#1c1c1f' }) {
  const id = uid('st');
  return svg(
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.25)}"/><stop offset="1" stop-color="${darken(color, 0.2)}"/></linearGradient>`,
    ground(400, 680, 270, 22) +
      `<g filter="url(#drop)">` +
      `<rect x="150" y="575" width="500" height="80" rx="40" fill="url(#${id})"/>` +
      `<rect x="372" y="250" width="56" height="340" rx="22" fill="url(#${id})"/>` +
      `<circle cx="400" cy="250" r="112" fill="url(#${id})"/>` +
      `<circle cx="400" cy="250" r="84" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="6"/>` +
      `<ellipse cx="236" cy="590" rx="56" ry="22" fill="${lighten(color, 0.35)}"/>` +
      `<rect x="500" y="580" width="110" height="26" rx="13" fill="${lighten(color, 0.3)}"/>` +
      `<circle cx="400" cy="640" r="4" fill="#34d399"/>` +
      `</g>`,
  );
}

// ---------- protection ----------
export function caseArt({ color, inner = null, cam = 'square3', clear = false }) {
  const id = uid('cs');
  const x = 255;
  const y = 95;
  const w = 290;
  const h = 610;
  const r = 50;
  const phoneColor = inner || '#d9d4cf';
  const body = clear
    ? phoneBack({ x: x + 12, y: y + 12, w: w - 24, h: h - 24, color: phoneColor, cam, rot: 0 }) +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#eef6ff" fill-opacity="0.22" stroke="#ffffff" stroke-opacity="0.9" stroke-width="10"/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="#9fb3c8" stroke-opacity="0.45" stroke-width="2"/>` +
      `<circle cx="${x + w / 2}" cy="${y + h * 0.52}" r="92" fill="none" stroke="#fff" stroke-opacity="0.75" stroke-width="7"/>` +
      `<path d="M${x + 40} ${y + 12} L${x + w * 0.62} ${y + 12} L${x + 12} ${y + h * 0.5} L${x + 12} ${y + 60} Z" fill="#fff" opacity="0.18"/>`
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#${id})"/>` +
      `<rect x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}" rx="${r - 8}" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="3"/>` +
      `<rect x="${x + 20}" y="${y + 20}" width="${w * 0.52}" height="${w * 0.52}" rx="${w * 0.13}" fill="${darken(color, 0.35)}"/>` +
      `<rect x="${x + 26}" y="${y + 26}" width="${w * 0.52 - 12}" height="${w * 0.52 - 12}" rx="${w * 0.11}" fill="#16171b"/>` +
      lens(x + 26 + w * 0.15, y + 26 + w * 0.13, w * 0.085) +
      lens(x + 26 + w * 0.15, y + 26 + w * 0.36, w * 0.085) +
      lens(x + 26 + w * 0.37, y + 26 + w * 0.245, w * 0.085) +
      `<rect x="${x + w - 4}" y="${y + h * 0.24}" width="9" height="${h * 0.15}" rx="4" fill="${darken(color, 0.2)}"/>` +
      `<ellipse cx="${x + w * 0.35}" cy="${y + h * 0.18}" rx="${w * 0.4}" ry="${h * 0.2}" fill="#fff" opacity="0.07"/>`;
  return svg(
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.18)}"/><stop offset="0.6" stop-color="${color}"/><stop offset="1" stop-color="${darken(color, 0.2)}"/></linearGradient>`,
    ground(400, 724, 190, 20) + `<g filter="url(#drop)" transform="rotate(-8 400 400)">${body}</g>`,
  );
}

export function glassArt({ privacy = false }) {
  const wall = privacy ? WALLPAPERS.black : WALLPAPERS.white;
  return svg(
    '',
    ground(400, 720, 230, 22) +
      `<g opacity="0.9">${phoneFront({ x: 300, y: 130, w: 270, h: 560, color: '#9a9ba3', wall, rot: 6 })}</g>` +
      `<g transform="rotate(-4 380 380)" filter="url(#drop)">` +
      `<rect x="200" y="90" width="282" height="580" rx="46" fill="${privacy ? '#1a1b22' : '#dff3ff'}" fill-opacity="${privacy ? 0.72 : 0.38}" stroke="#ffffff" stroke-width="5" stroke-opacity="0.95"/>` +
      `<path d="M210 120 L330 100 L215 420 Z" fill="#fff" opacity="0.32"/>` +
      `<path d="M300 670 L470 420 L478 520 L360 672 Z" fill="#fff" opacity="0.18"/>` +
      `<circle cx="341" cy="122" r="9" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="2"/>` +
      `</g>`,
  );
}

export function lensGuardArt() {
  return svg(
    '',
    ground(400, 640, 200, 20) +
      `<g filter="url(#drop)" transform="rotate(-10 400 400)">` +
      `<rect x="250" y="230" width="300" height="300" rx="70" fill="#d7d8de" fill-opacity="0.35" stroke="#fff" stroke-width="6"/>` +
      lens(330, 315, 62) +
      lens(330, 450, 62) +
      lens(470, 382, 62) +
      [
        [330, 315],
        [330, 450],
        [470, 382],
      ]
        .map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="70" fill="#e8f6ff" fill-opacity="0.18" stroke="#fff" stroke-opacity="0.9" stroke-width="5"/>`)
        .join('') +
      `</g>`,
  );
}

export function mountArt({ color = '#232326' }) {
  const id = uid('mt');
  return svg(
    `<radialGradient id="${id}" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="${lighten(color, 0.3)}"/><stop offset="1" stop-color="${darken(color, 0.25)}"/></radialGradient>`,
    ground(400, 700, 200, 20) +
      [0, 1, 2, 3].map((i) => `<rect x="150" y="${300 + i * 70}" width="500" height="26" rx="13" fill="#cfd0d6" opacity="0.6"/>`).join('') +
      `<g filter="url(#drop)">` +
      `<rect x="380" y="400" width="40" height="190" rx="18" fill="${darken(color, 0.1)}"/>` +
      `<circle cx="400" cy="600" r="34" fill="url(#${id})"/>` +
      `<circle cx="400" cy="360" r="168" fill="url(#${id})"/>` +
      `<circle cx="400" cy="360" r="130" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="10"/>` +
      `<circle cx="400" cy="360" r="96" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="4"/>` +
      `<ellipse cx="350" cy="280" rx="70" ry="30" fill="#fff" opacity="0.14"/>` +
      `</g>`,
  );
}

export function headphonesArt({ color = '#1f1f22' }) {
  const id = uid('hp');
  return svg(
    `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lighten(color, 0.3)}"/><stop offset="1" stop-color="${darken(color, 0.2)}"/></linearGradient>`,
    ground(400, 700, 230, 22) +
      `<g filter="url(#drop)">` +
      `<path d="M215 470 C 200 230, 600 230, 585 470" fill="none" stroke="url(#${id})" stroke-width="40" stroke-linecap="round"/>` +
      `<rect x="160" y="430" width="140" height="210" rx="62" fill="url(#${id})"/>` +
      `<rect x="500" y="430" width="140" height="210" rx="62" fill="url(#${id})"/>` +
      `<rect x="282" y="450" width="40" height="170" rx="20" fill="${darken(color, 0.35)}"/>` +
      `<rect x="478" y="450" width="40" height="170" rx="20" fill="${darken(color, 0.35)}"/>` +
      `<ellipse cx="210" cy="480" rx="30" ry="18" fill="#fff" opacity="0.2"/>` +
      `</g>`,
  );
}

/** Renders a seed art spec to an SVG string. */
export function renderArt(spec) {
  seq = 0;
  switch (spec.type) {
    case 'phone':
      return phoneArt(spec);
    case 'flip':
      return foldArt(spec);
    case 'tablet':
      return tabletArt(spec);
    case 'watch':
      return watchArt(spec);
    case 'buds':
      return budsArt(spec);
    case 'headphones':
      return headphonesArt(spec);
    case 'charger':
      return chargerArt(spec);
    case 'cable':
      return cableArt(spec);
    case 'powerbank':
      return powerbankArt(spec);
    case 'pad':
      return padArt(spec);
    case 'stand':
      return standArt(spec);
    case 'case':
      return caseArt(spec);
    case 'glass':
      return glassArt(spec);
    case 'lens':
      return lensGuardArt(spec);
    case 'mount':
      return mountArt(spec);
    default:
      return svg('', `<rect x="200" y="200" width="400" height="400" rx="60" fill="#ddd"/>`);
  }
}
