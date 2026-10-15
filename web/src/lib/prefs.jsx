// Visitor preferences: language (EN/AR), currency (USD/LBP) and theme. Saved in the browser.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import enBase from '../i18n/en.js';
import arBase from '../i18n/ar.js';
import adminEn from '../i18n/admin-en.js';
import adminAr from '../i18n/admin-ar.js';

const en = { ...enBase, admin: adminEn };
const ar = { ...arBase, admin: adminAr };

const KEY = 'sps:prefs';
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    return {};
  }
};
const write = (p) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
};

const PrefsCtx = createContext(null);
const DICTS = { en, ar };

function systemDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    const p = read();
    const lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
    return { lang: p.lang || lang, currency: p.currency === 'LBP' ? 'LBP' : 'USD', theme: p.theme || 'system' };
  });
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const on = () => setSysDark(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && sysDark);
  useEffect(() => {
    const d = document.documentElement;
    d.lang = prefs.lang;
    d.dir = prefs.lang === 'ar' ? 'rtl' : 'ltr';
    d.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#09090b' : '#f2f2f4');
    write(prefs);
  }, [prefs, dark]);

  const update = useCallback((patch) => setPrefs((p) => ({ ...p, ...patch })), []);
  const value = useMemo(() => ({ ...prefs, dark, update }), [prefs, dark, update]);
  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export const usePrefs = () => useContext(PrefsCtx);

// ---------------- translation ----------------
function lookup(dict, key) {
  return key.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
}
const plural = { en: new Intl.PluralRules('en'), ar: new Intl.PluralRules('ar') };

export function translate(lang, key, vars) {
  let v = lookup(DICTS[lang], key);
  if (v === undefined) v = lookup(DICTS.en, key);
  if (v && typeof v === 'object' && vars && typeof vars.count === 'number') {
    const rule = plural[lang]?.select(vars.count) || 'other';
    v = v[rule] ?? v.other ?? v.one;
  }
  if (typeof v !== 'string') return key;
  return vars ? v.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)) : v;
}

export function useT() {
  const { lang } = usePrefs();
  return useMemo(() => {
    const t = (key, vars) => translate(lang, key, vars);
    /** Picks the right language from {en, ar} objects or *_en/*_ar fields */
    const L = (obj, field) => {
      if (obj == null) return '';
      if (field) return (lang === 'ar' ? obj[`${field}_ar`] : obj[`${field}_en`]) || obj[`${field}_en`] || '';
      if (typeof obj === 'string') return obj;
      return (lang === 'ar' ? obj.ar : obj.en) || obj.en || '';
    };
    const locale = lang === 'ar' ? 'ar-LB-u-nu-latn' : 'en-GB';
    const date = (iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => (iso ? new Intl.DateTimeFormat(locale, opts).format(new Date(iso)) : '');
    const dateTime = (iso) => date(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const ago = (iso) => {
      const s = (Date.now() - new Date(iso).getTime()) / 1000;
      const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { numeric: 'auto' });
      if (s < 60) return rtf.format(-Math.round(s), 'second');
      if (s < 3600) return rtf.format(-Math.round(s / 60), 'minute');
      if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
      if (s < 86400 * 30) return rtf.format(-Math.round(s / 86400), 'day');
      return date(iso);
    };
    const num = (n, d = 0) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: d });
    /** Raw dictionary value (arrays, objects). */
    const raw = (key) => lookup(DICTS[lang], key) ?? lookup(DICTS.en, key);
    return { t, L, lang, rtl: lang === 'ar', date, dateTime, ago, num, raw };
  }, [lang]);
}
