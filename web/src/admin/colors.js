// Same color grouping as the server (core/catalog.js), used for the live preview card.
export function colorFamilyClient(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  if (l < 0.2) return 'black';
  if (l > 0.93) return 'white';
  if (s < 0.14 || (s < 0.22 && l > 0.8)) return l > 0.62 ? (l > 0.86 ? 'white' : 'silver') : 'gray';
  if (h < 14 || h >= 345) return l > 0.68 ? 'pink' : 'red';
  if (h < 38) return l > 0.75 ? 'gold' : 'orange';
  if (h < 62) return 'gold';
  if (h < 168) return 'green';
  if (h < 255) return 'blue';
  if (h < 292) return 'purple';
  return 'pink';
}
