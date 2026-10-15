import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ArrowUpRight, Clock, Mic, Search, TrendingUp, X, CornerDownLeft } from 'lucide-react';
import { createPortal } from 'react-dom';
import { api, qs } from '../lib/api.js';
import { useT } from '../lib/prefs.jsx';
import { useStore } from '../lib/store.jsx';
import { useUI } from '../lib/ui.jsx';
import { readJSON, writeJSON } from '../lib/cart.jsx';
import { Img, Price, Spinner, cx, usePresence } from './ui.jsx';
import { categoryIcon } from './icons.jsx';

const RECENT = 'sps:searches';
export const saveSearch = (q) => {
  const v = String(q || '').trim();
  if (!v) return;
  writeJSON(RECENT, [v, ...readJSON(RECENT, []).filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6));
};

function useSpeech(lang, onText) {
  const [listening, setListening] = useState(false);
  const rec = useRef(null);
  const Supported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const start = () => {
    if (!Supported) return;
    try {
      const r = new Supported();
      r.lang = lang === 'ar' ? 'ar-LB' : 'en-US';
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onresult = (e) => onText([...e.results].map((x) => x[0].transcript).join(' '), e.results[e.results.length - 1].isFinal);
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      rec.current = r;
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };
  const stop = () => {
    rec.current?.stop();
    setListening(false);
  };
  return { supported: !!Supported, listening, start, stop };
}

export function SearchOverlay() {
  const ui = useUI();
  const { t, L, lang } = useT();
  const store = useStore();
  const navigate = useNavigate();
  const { mounted, visible } = usePresence(ui.searchOpen, 220);
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState([]);
  const input = useRef(null);
  const speech = useSpeech(lang, (text, final) => {
    setQ(text);
    if (final) setTimeout(() => go(text), 350);
  });

  useEffect(() => {
    if (!ui.searchOpen) return;
    setRecent(readJSON(RECENT, []));
    setActive(0);
    const id = setTimeout(() => input.current?.focus(), 60);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(id);
      document.body.style.overflow = prev;
    };
  }, [ui.searchOpen]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setRes(null);
      return;
    }
    setBusy(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const r = await api(`/api/search/suggest${qs({ q: term })}`, { signal: ctrl.signal });
        setRes(r);
        setActive(0);
      } catch {
        /* ignore aborted */
      } finally {
        setBusy(false);
      }
    }, 140);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q]);

  function go(term) {
    const v = String(term ?? q).trim();
    if (!v) return;
    saveSearch(v);
    ui.closeSearch();
    setQ('');
    navigate(`/search${qs({ q: v })}`);
  }

  // Flat list of selectable entries for keyboard navigation.
  const entries = useMemo(() => {
    if (!res) return [];
    return [
      ...res.products.map((p) => ({ kind: 'p', to: `/product/${p.slug}`, item: p })),
      ...res.categories.map((c) => ({ kind: 'c', to: `/c/${c.slug}`, item: c })),
      ...res.brands.map((b) => ({ kind: 'b', to: `/b/${b.slug}`, item: b })),
    ];
  }, [res]);

  const onKey = (e) => {
    if (e.key === 'Escape') ui.closeSearch();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(entries.length, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active > 0 && entries[active - 1]) {
        saveSearch(q);
        ui.closeSearch();
        setQ('');
        navigate(entries[active - 1].to);
      } else go();
    }
  };

  if (!mounted) return null;
  const trending = store.settings.home.trending || [];
  const cats = store.categories.filter((c) => c.count > 0).slice(0, 8);
  let idx = 0;

  return createPortal(
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-label={t('nav.search')}>
      <div className={cx('absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-200', visible ? 'opacity-100' : 'opacity-0')} onClick={ui.closeSearch} />
      <div
        className={cx(
          'relative mx-auto flex h-full w-full flex-col bg-surface transition duration-300 ease-[var(--ease-out-expo)] sm:mt-[8vh] sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-[28px] sm:shadow-[var(--shadow-pop)]',
          visible ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0',
        )}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
          <Search className="size-5 shrink-0 text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder={speech.listening ? t('search.listening') : t('search.placeholder')}
            className="h-12 min-w-0 flex-1 bg-transparent text-[17px] font-medium outline-none placeholder:text-faint"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
          />
          {busy && <Spinner className="size-4" />}
          {q && (
            <button onClick={() => setQ('')} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-3" aria-label={t('common.clear')}>
              <X className="size-4" />
            </button>
          )}
          {speech.supported && (
            <button
              onClick={speech.listening ? speech.stop : speech.start}
              className={cx('relative grid size-10 place-items-center rounded-full transition', speech.listening ? 'bg-hot text-white' : 'text-ink hover:bg-surface-3')}
              aria-label={t('search.voice')}
              title={t('search.voice')}
            >
              {speech.listening && <span className="absolute inset-0 animate-ping-slow rounded-full bg-hot" />}
              <Mic className="relative size-5" />
            </button>
          )}
          <button onClick={ui.closeSearch} className="ms-1 rounded-full px-3 py-1.5 text-sm font-semibold text-muted hover:bg-surface-3 sm:hidden">
            {t('common.cancel')}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
          {!q.trim() ? (
            <div className="space-y-6 p-1">
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="eyebrow text-muted">{t('search.recent')}</p>
                    <button
                      className="text-xs font-semibold text-muted hover:text-ink"
                      onClick={() => {
                        writeJSON(RECENT, []);
                        setRecent([]);
                      }}
                    >
                      {t('search.clear')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button key={r} onClick={() => go(r)} className="inline-flex items-center gap-1.5 rounded-full border border-line-strong px-3 py-1.5 text-sm hover:border-ink">
                        <Clock className="size-3.5 text-muted" /> {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {trending.length > 0 && (
                <div>
                  <p className="eyebrow mb-2 text-muted">{t('search.trending')}</p>
                  <div className="flex flex-wrap gap-2">
                    {trending.map((r) => (
                      <button key={r} onClick={() => go(r)} className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-sm font-medium hover:bg-line">
                        <TrendingUp className="size-3.5 text-hot" /> {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="eyebrow mb-2 text-muted">{t('search.categories')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {cats.map((c) => {
                    const Icon = categoryIcon(c.icon);
                    return (
                      <Link key={c.id} to={`/c/${c.slug}`} onClick={ui.closeSearch} className="flex items-center gap-2.5 rounded-2xl bg-surface-2 p-3 text-sm font-semibold transition hover:bg-surface-3">
                        <Icon className="size-[18px] text-muted" strokeWidth={1.8} />
                        <span className="truncate">{L(c.name)}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : res && !res.products.length && !res.categories.length && !res.brands.length ? (
            <div className="px-4 py-12 text-center">
              <p className="font-semibold">{t('search.no_results', { q })}</p>
              {res.correction && (
                <button onClick={() => setQ(res.correction)} className="mt-3 text-sm text-muted">
                  {t('shop.did_you_mean')} <span className="font-bold text-ink underline">{res.correction}</span>?
                </button>
              )}
            </div>
          ) : (
            res && (
              <div className="space-y-4">
                {res.products.length > 0 && (
                  <div>
                    <p className="eyebrow mb-1 px-2 text-muted">{t('search.products')}</p>
                    {res.products.map((p) => {
                      const i = ++idx;
                      return (
                        <Link
                          key={p.id}
                          to={`/product/${p.slug}`}
                          onClick={() => {
                            saveSearch(q);
                            ui.closeSearch();
                            setQ('');
                          }}
                          onMouseEnter={() => setActive(i)}
                          className={cx('flex items-center gap-3 rounded-2xl p-2 transition', active === i ? 'bg-surface-3' : 'hover:bg-surface-2')}
                        >
                          <Img thumb src={p.image} alt="" className="size-14 shrink-0 rounded-xl silver p-1" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{L(p.name)}</span>
                            <span className="block truncate text-xs text-muted">{[p.brand, p.category && L(p.category)].filter(Boolean).join(' · ')}</span>
                          </span>
                          <span className="text-end text-sm">
                            <Price value={p.price_min} compareAt={p.compare_at} size="sm" />
                            {!p.in_stock && <span className="block text-[11px] text-danger">{t('product.out_of_stock')}</span>}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {(res.categories.length > 0 || res.brands.length > 0) && (
                  <div className="flex flex-wrap gap-2 px-2">
                    {res.categories.map((c) => {
                      const i = ++idx;
                      return (
                        <Link key={c.id} to={`/c/${c.slug}`} onClick={ui.closeSearch} onMouseEnter={() => setActive(i)} className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', active === i ? 'border-ink' : 'border-line-strong')}>
                          {L(c.name)} <ArrowUpRight className="size-3.5 text-muted" />
                        </Link>
                      );
                    })}
                    {res.brands.map((b) => {
                      const i = ++idx;
                      return (
                        <Link key={b.id} to={`/b/${b.slug}`} onClick={ui.closeSearch} onMouseEnter={() => setActive(i)} className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold', active === i ? 'border-ink' : 'border-line-strong')}>
                          {b.name} <ArrowUpRight className="size-3.5 text-muted" />
                        </Link>
                      );
                    })}
                  </div>
                )}
                <button onClick={() => go()} className={cx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-bold transition', active === 0 ? 'bg-inverse text-on-inverse' : 'bg-surface-3')}>
                  {t('search.see_all', { count: res.total })} <ArrowRight className="size-4 rtl:-scale-x-100" />
                </button>
              </div>
            )
          )}
        </div>
        <div className="hidden items-center gap-4 border-t border-line px-5 py-2.5 text-[11px] text-muted sm:flex">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-line-strong px-1">↑</kbd>
            <kbd className="rounded border border-line-strong px-1">↓</kbd> {t('search.hint_move')}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-line-strong px-1">
              <CornerDownLeft className="inline size-3" />
            </kbd>{' '}
            {t('search.hint_open')}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-line-strong px-1">esc</kbd> {t('search.hint_close')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
