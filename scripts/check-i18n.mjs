// Checks that every t('key') used in the website exists in English and Arabic.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import en from '../web/src/i18n/en.js';
import ar from '../web/src/i18n/ar.js';
import adminEn from '../web/src/i18n/admin-en.js';
import adminAr from '../web/src/i18n/admin-ar.js';

const dicts = { en: { ...en, admin: adminEn }, ar: { ...ar, admin: adminAr } };
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|mjs)$/.test(f) && !p.includes('i18n')) files.push(p);
  }
};
walk(new URL('../web/src', import.meta.url).pathname);
const keys = new Set();
const dynamic = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*['`]([a-z_][a-z0-9_.]*(?:\$\{[^}]+\}[a-z0-9_.]*)*)['`]/gi)) {
    if (m[1].includes('${')) dynamic.add(m[1]);
    else keys.add(m[1]);
  }
}
const get = (o, k) => k.split('.').reduce((x, p) => (x == null ? x : x[p]), o);
let missing = 0;
for (const k of [...keys].sort()) {
  for (const lang of ['en', 'ar']) {
    if (get(dicts[lang], k) === undefined) {
      console.log(`missing ${lang}: ${k}`);
      missing++;
    }
  }
}
// Arabic should define every English key (structure check)
const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) && !('other' in v) ? flat(v, pre + k + '.') : [pre + k]));
for (const k of flat(dicts.en)) if (get(dicts.ar, k) === undefined) { console.log(`ar lacks: ${k}`); missing++; }
console.log(`${keys.size} keys used, ${dynamic.size} dynamic, ${missing} problems`);
process.exit(missing ? 1 : 0);
