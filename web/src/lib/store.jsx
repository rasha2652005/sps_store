// Store-wide data loaded once (settings, categories, brands, devices) + money formatting.
import { createContext, useContext, useMemo } from 'react';
import { useApi } from './api.js';
import { usePrefs } from './prefs.jsx';

const StoreCtx = createContext(null);

export function StoreProvider({ children, fallback, errorView }) {
  const { data, error, reload } = useApi('/api/bootstrap', { ttl: 5 * 60 * 1000 });
  const value = useMemo(() => (data ? { ...data, reload } : null), [data, reload]);
  if (!value) return error ? errorView?.(reload) : fallback;
  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);

export function useMoney() {
  const { currency, lang } = usePrefs();
  const store = useStore();
  const rate = Number(store?.settings?.currency?.lbp_rate) || 0;
  const showLbp = !!store?.settings?.currency?.show_lbp && rate > 0;
  return useMemo(() => {
    const usd = (n) => {
      const v = Number(n) || 0;
      return `$${v.toLocaleString('en-US', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
    };
    const lbpNumber = (n) => Math.round(((Number(n) || 0) * rate) / 1000) * 1000;
    const lbp = (n) => `${lbpNumber(n).toLocaleString('en-US')} ${lang === 'ar' ? 'ل.ل.' : 'LBP'}`;
    const cur = showLbp && currency === 'LBP' ? 'LBP' : 'USD';
    return { usd, lbp, lbpNumber, fmt: (n) => (cur === 'LBP' ? lbp(n) : usd(n)), alt: (n) => (cur === 'LBP' ? usd(n) : showLbp ? lbp(n) : ''), currency: cur, rate, showLbp };
  }, [currency, lang, rate, showLbp]);
}

/** wa.me link for the store's WhatsApp number. */
export function useWhatsApp() {
  const store = useStore();
  const num = String(store?.settings?.store?.whatsapp || '').replace(/\D/g, '');
  return (text) => (num ? `https://wa.me/${num}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null);
}
