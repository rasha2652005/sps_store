// Smart product search: English + Arabic (+ common Lebanese words), typo tolerant, no external service.
// Works on the in-memory catalog snapshot, so it is fast for shops with a few thousand products.
import { westernDigits } from './util.js';

export function normalize(s) {
  return westernDigits(String(s ?? ''))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Latin accents
    .replace(/[ً-ٰٟـ]/g, '') // Arabic harakat + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\+/g, ' plus ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Words people type -> one canonical token. Keys are already normalized.
const SYNONYM_GROUPS = {
  iphone: ['ايفون', 'ايفن', 'افون', 'آيفون', 'iphon', 'ifone', 'aifon', 'ifon'],
  apple: ['ابل', 'اپل', 'تفاحه'],
  samsung: ['سامسونج', 'سامسونغ', 'سامسنج', 'سمسونج', 'samsong', 'samsng', 'sumsung'],
  galaxy: ['جالكسي', 'غالاكسي', 'جلاكسي', 'جالاكسي', 'غلاكسي', 'galaxi'],
  xiaomi: ['شاومي', 'شياومي', 'xiomi', 'xaomi'],
  redmi: ['ريدمي', 'ردمي'],
  google: ['جوجل', 'غوغل', 'قوقل'],
  pixel: ['بكسل', 'بيكسل'],
  ipad: ['ايباد', 'آيباد'],
  airpods: ['ايربودز', 'ايربود', 'airpod'],
  pro: ['برو'],
  max: ['ماكس'],
  ultra: ['الترا', 'التر'],
  plus: ['بلس'],
  mini: ['ميني'],
  air: ['اير', 'ايير'],
  fold: ['فولد'],
  flip: ['فليب'],
  note: ['نوت'],
  phone: ['تلفون', 'تلفونات', 'تليفون', 'تيليفون', 'موبايل', 'موبايلات', 'جوال', 'هاتف', 'هواتف', 'telephone', 'telefon', 'mobile', 'phones', 'smartphone', 'smartphones'],
  case: ['كفر', 'كفرات', 'كفره', 'جراب', 'غطاء', 'cover', 'covers', 'cases', 'kfr', 'kafar'],
  charger: ['شاحن', 'شواحن', 'chargers', 'adapter', 'adaptor', 'charging', 'شحن', 'charge', 'شارجر'],
  cable: ['كابل', 'كيبل', 'كابلات', 'شريط', 'شرايط', 'wire', 'cables', 'cord'],
  earbuds: ['سماعات', 'سماعه', 'earphones', 'earphone', 'headphones', 'headphone', 'headset', 'buds', 'earbud', 'audio'],
  watch: ['ساعه', 'ساعات', 'smartwatch', 'watches'],
  power: ['باور'],
  bank: ['بنك'],
  powerbank: ['باوربنك'],
  protector: ['لزقه', 'لزقات', 'حمايه', 'glass', 'tempered', 'protectors', 'سكرين'],
  screen: ['شاشه', 'شاشات'],
  wireless: ['لاسلكي', 'وايرلس'],
  fast: ['سريع'],
  car: ['سياره', 'سيارات'],
  holder: ['حامل', 'ستاند', 'stand', 'mount'],
  tablet: ['تابلت', 'تابلات', 'لوحي', 'tablets'],
  used: ['مستعمل', 'مستعمله', 'secondhand', 'second'],
  new: ['جديد', 'جديده'],
  refurbished: ['مجدد', 'refurb'],
  black: ['اسود', 'سودا', 'سوداء'],
  white: ['ابيض', 'بيضا', 'بيضاء'],
  blue: ['ازرق', 'زرقا', 'كحلي'],
  orange: ['برتقالي'],
  gold: ['ذهبي', 'دهبي'],
  silver: ['فضي'],
  pink: ['زهر', 'زهري', 'وردي'],
  green: ['اخضر', 'خضرا'],
  purple: ['بنفسجي', 'موف', 'ليلكي'],
  gray: ['رمادي', 'grey', 'سكني'],
  gb: ['جيجا', 'غيغا', 'giga'],
  tb: ['تيرا'],
};

const SYN = new Map();
for (const [canon, words] of Object.entries(SYNONYM_GROUPS)) {
  for (const w of words) SYN.set(normalize(w), canon);
}

const isNumeric = (t) => /^\d+$/.test(t);
const hasDigit = (t) => /\d/.test(t);

/** Splits normalized text into tokens, also splitting letter/digit boundaries ("s25" -> s25, s, 25). */
export function tokenize(text) {
  const out = [];
  for (const raw of normalize(text).split(' ')) {
    if (!raw) continue;
    const t = SYN.get(raw) || raw;
    out.push(t);
    if (hasDigit(t) && /\p{L}/u.test(t)) {
      for (const part of t.split(/(?<=\d)(?=\p{L})|(?<=\p{L})(?=\d)/u)) {
        if (part && part !== t) out.push(SYN.get(part) || part);
      }
    }
    // "128gb" -> also "128"; "1tb" -> "1"
  }
  return out;
}

// Restricted Damerau-Levenshtein with a cutoff.
function editDistance(a, b, max) {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  let prevPrev = null;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prevPrev[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = cur;
  }
  return prev[lb];
}

function maxTypos(t) {
  if (hasDigit(t)) return 0;
  if (t.length >= 8) return 2;
  if (t.length >= 4) return 1;
  return 0;
}

/** Builds the index for a list of catalog products (see catalog.js). */
export function buildIndex(products) {
  const docs = [];
  const vocab = new Map(); // token -> document frequency
  for (const p of products) {
    const tokens = new Map();
    const add = (text, w) => {
      for (const t of tokenize(text)) {
        if (t.length < 1) continue;
        if ((tokens.get(t) || 0) < w) tokens.set(t, w);
      }
    };
    add(p.name.en, 3);
    add(p.name.ar, 3);
    add(p.device, 2.5);
    add(p.brand?.name, 2.2);
    add(p.category?.name.en, 1.6);
    add(p.category?.name.ar, 1.6);
    add(p.tags.join(' '), 1.3);
    add(p.subtitle.en, 0.8);
    add(p.subtitle.ar, 0.8);
    add(p.fits.join(' '), 1.1);
    add(p.condition, 0.9);
    for (const c of p.colors) {
      add(c.en, 0.8);
      add(c.ar, 0.8);
      add(c.family, 0.6);
    }
    add(p.opts.join(' '), 0.8);
    for (const t of tokens.keys()) vocab.set(t, (vocab.get(t) || 0) + 1);
    docs.push({ p, tokens, name: normalize(`${p.name.en} `), nameAr: normalize(p.name.ar) });
  }
  return { docs, vocab: [...vocab.keys()] };
}

function tokenScore(qt, tokens) {
  let best = 0;
  const typos = maxTypos(qt);
  for (const [tok, w] of tokens) {
    let s = 0;
    if (tok === qt) s = 1;
    else if (tok.startsWith(qt) && (qt.length >= 2 || isNumeric(qt)) && !(isNumeric(qt) && isNumeric(tok))) s = 0.78;
    else if (!isNumeric(qt) && qt.length >= 3 && tok.length > qt.length && tok.includes(qt)) s = 0.5;
    else if (typos > 0 && tok[0] === qt[0] && !hasDigit(tok) && Math.abs(tok.length - qt.length) <= typos) {
      const d = editDistance(qt, tok, typos);
      if (d <= typos) s = d <= 1 ? 0.62 : 0.45;
    }
    if (s * w > best) best = s * w;
    if (best >= 3) break;
  }
  return best;
}

/**
 * Searches the index. Returns [{ p, score }] sorted by score, plus a "did you mean" correction when the
 * query only matched through typo tolerance.
 */
export function search(index, query, { limit = 500 } = {}) {
  const qNorm = normalize(query);
  const qTokens = [...new Set(tokenize(query))].filter((t) => t.length > 0).slice(0, 8);
  if (!qTokens.length) return { results: [], correction: null };

  const scoreAll = (minMatched) => {
    const res = [];
    for (const d of index.docs) {
      let total = 0;
      let matched = 0;
      for (const qt of qTokens) {
        const s = tokenScore(qt, d.tokens);
        if (s > 0) {
          matched++;
          total += s;
        }
      }
      if (matched < minMatched) continue;
      // phrase bonuses
      if (qNorm.length >= 3 && (d.name.includes(qNorm) || d.nameAr.includes(qNorm))) total += 2;
      if (d.name.trim() === qNorm || d.nameAr === qNorm) total += 2.5;
      const rel = total;
      // prefer products whose name is mostly covered by the query (iPhone 17 before iPhone 17 Pro Max)
      const nameLen = d.name.split(' ').filter(Boolean).length || 1;
      total += Math.min(1, matched / nameLen) * 0.8;
      const p = d.p;
      if (p.in_stock) total += 0.6;
      if (p.featured) total += 0.25;
      total += Math.log10(1 + (p.sold_count || 0)) * 0.25;
      res.push({ p, score: total, matched, rel });
    }
    res.sort((a, b) => b.score - a.score || b.matched - a.matched);
    // One generic word ("case", "charger"...): drop weak matches that only mention it in passing.
    if (qTokens.length === 1 && res.length) {
      const best = Math.max(...res.map((r) => r.rel));
      return res.filter((r) => r.rel >= best * 0.3);
    }
    return res;
  };

  let results = scoreAll(qTokens.length);
  if (!results.length && qTokens.length > 1) results = scoreAll(Math.ceil(qTokens.length / 2));

  // "Did you mean": replace tokens that do not exist in the vocabulary with their closest word.
  let correction = null;
  const vocab = index.vocab;
  const fixed = qTokens.map((qt) => {
    if (vocab.includes(qt) || vocab.some((v) => v.startsWith(qt))) return qt;
    const typos = maxTypos(qt);
    if (!typos) return qt;
    let best = null;
    let bestD = typos + 1;
    for (const v of vocab) {
      if (v[0] !== qt[0] || Math.abs(v.length - qt.length) > typos) continue;
      const d = editDistance(qt, v, typos);
      if (d < bestD) {
        bestD = d;
        best = v;
      }
    }
    return best || qt;
  });
  if (fixed.join(' ') !== qTokens.join(' ')) correction = fixed.join(' ');

  return { results: results.slice(0, limit), correction };
}
