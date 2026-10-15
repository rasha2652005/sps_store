// Shared UI building blocks.
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';
import { Link } from 'react-router';
import { Loader2, Minus, Plus, Star, X } from 'lucide-react';
import { useMoney } from '../lib/store.jsx';
import { useT } from '../lib/prefs.jsx';
import { assetUrl, thumbUrl } from '../lib/links.js';

/** Joins class names and resolves Tailwind conflicts (the last one wins, e.g. "inline-flex … hidden"). */
export const cx = (...a) => twMerge(a.flat(Infinity).filter(Boolean).join(' '));

// ---------------- buttons ----------------
const BTN_VARIANTS = {
  primary: 'bg-inverse text-on-inverse hover:opacity-90 shadow-[0_6px_20px_-8px_rgb(var(--shadow-rgb)/0.6)]',
  secondary: 'bg-surface-3 text-ink hover:bg-line',
  outline: 'border border-line-strong bg-surface text-ink hover:border-ink',
  ghost: 'text-ink hover:bg-surface-3',
  hot: 'bg-hot text-white hover:brightness-110 shadow-[0_8px_24px_-10px_var(--hot)]',
  whatsapp: 'bg-wa text-white hover:brightness-110',
  danger: 'bg-danger text-white hover:brightness-110',
  light: 'bg-white text-black hover:bg-white/90',
  glass: 'bg-white/10 text-white hover:bg-white/20 backdrop-blur border border-white/15',
};
const BTN_SIZES = {
  xs: 'h-8 px-3 text-xs gap-1.5 rounded-full',
  sm: 'h-9 px-4 text-sm gap-2 rounded-full',
  md: 'h-11 px-5 text-sm gap-2 rounded-full',
  lg: 'h-13 px-7 text-[15px] gap-2.5 rounded-full',
};

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', icon: Icon, iconEnd: IconEnd, loading, className, children, to, href, block, ...rest },
  ref,
) {
  const cls = cx(
    'relative inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition duration-200 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100',
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
    block && 'w-full',
    className,
  );
  const inner = (
    <>
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className={size === 'lg' ? 'size-5' : 'size-4'} />}
      {children}
      {IconEnd && <IconEnd className="size-4 rtl:-scale-x-100" />}
    </>
  );
  if (to) return <Link ref={ref} to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a ref={ref} href={href} className={cls} {...rest}>{inner}</a>;
  return (
    <button ref={ref} className={cls} disabled={loading || rest.disabled} {...rest}>
      {inner}
    </button>
  );
});

export function IconButton({ icon: Icon, label, className, badge, size = 'md', variant = 'ghost', to, href, ...rest }) {
  const cls = cx(
    'relative inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95',
    size === 'sm' ? 'size-9' : size === 'lg' ? 'size-12' : 'size-10',
    variant === 'ghost' && 'text-ink hover:bg-surface-3',
    variant === 'surface' && 'bg-surface text-ink shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-lift)]',
    variant === 'solid' && 'bg-inverse text-on-inverse',
    variant === 'glass' && 'bg-white/10 text-white backdrop-blur hover:bg-white/20',
    className,
  );
  const content = (
    <>
      <Icon className={size === 'sm' ? 'size-[18px]' : 'size-5'} strokeWidth={1.8} />
      {badge ? (
        <span className="absolute -end-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-hot px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </>
  );
  if (to) return <Link to={to} aria-label={label} title={label} className={cls} {...rest}>{content}</Link>;
  if (href) return <a href={href} aria-label={label} title={label} className={cls} {...rest}>{content}</a>;
  return (
    <button type="button" aria-label={label} title={label} className={cls} {...rest}>
      {content}
    </button>
  );
}

// ---------------- form controls ----------------
export function Field({ label, hint, error, children, className, required, htmlFor }) {
  return (
    <label className={cx('block', className)} htmlFor={htmlFor}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
          {label}
          {required && <span className="text-hot"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-danger">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const inputCls = (error, extra) =>
  cx(
    'w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-faint focus:border-ink focus:ring-4 focus:ring-ink/5 disabled:opacity-60',
    error ? 'border-danger' : 'border-line-strong',
    extra,
  );

export const Input = forwardRef(function Input({ error, className, prefix, suffix, ...rest }, ref) {
  if (prefix || suffix) {
    return (
      <div className={cx('flex items-center rounded-xl border bg-surface transition focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5', error ? 'border-danger' : 'border-line-strong', className)}>
        {prefix && <span className="ps-3.5 text-sm text-muted">{prefix}</span>}
        <input ref={ref} className="h-11 w-full min-w-0 bg-transparent px-3.5 text-[15px] text-ink outline-none placeholder:text-faint" {...rest} />
        {suffix && <span className="pe-3 text-sm text-muted">{suffix}</span>}
      </div>
    );
  }
  return <input ref={ref} className={inputCls(error, cx('h-11', className))} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ error, className, ...rest }, ref) {
  return <textarea ref={ref} className={inputCls(error, cx('min-h-24 py-2.5', className))} {...rest} />;
});

export const Select = forwardRef(function Select({ error, className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={inputCls(error, cx('h-11 cursor-pointer appearance-none bg-[length:16px] bg-[position:right_12px_center] bg-no-repeat pe-9 rtl:bg-[position:left_12px_center]', className))} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export function Checkbox({ checked, onChange, label, className, disabled }) {
  return (
    <label className={cx('flex cursor-pointer select-none items-center gap-2.5 text-sm', disabled && 'opacity-50', className)}>
      <span className={cx('grid size-5 shrink-0 place-items-center rounded-md border transition', checked ? 'border-ink bg-ink text-bg' : 'border-line-strong bg-surface')}>
        {checked && (
          <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M2.5 6.2 5 8.5l4.5-5" />
          </svg>
        )}
      </span>
      <input type="checkbox" className="sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
      {label}
    </label>
  );
}

export function Switch({ checked, onChange, label, hint, className, disabled }) {
  return (
    <label className={cx('flex cursor-pointer select-none items-center justify-between gap-4', disabled && 'opacity-50', className)}>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-semibold">{label}</span>}
          {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
      )}
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-ink' : 'bg-line-strong')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-surface shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')} />
      </span>
      <input type="checkbox" className="sr-only" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} />
    </label>
  );
}

// ---------------- display ----------------
const BADGE_TONES = {
  neutral: 'bg-surface-3 text-ink-2',
  inverse: 'bg-inverse text-on-inverse',
  hot: 'bg-hot text-white',
  ok: 'bg-ok/12 text-ok',
  warn: 'bg-warn/14 text-warn',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
  outline: 'border border-line-strong text-ink-2',
};
export function Badge({ tone = 'neutral', className, children, icon: Icon, slant }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 text-[11px] font-bold leading-5', slant ? 'slant' : 'rounded-full', BADGE_TONES[tone], className)}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export const Skeleton = ({ className }) => <div className={cx('skeleton', className)} />;
export const Spinner = ({ className }) => <Loader2 className={cx('size-5 animate-spin text-muted', className)} />;

export function Empty({ icon: Icon, title, text, children, className }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-5 grid size-16 place-items-center rounded-2xl silver text-muted shadow-[var(--shadow-soft)]">
          <Icon className="size-7" strokeWidth={1.6} />
        </div>
      )}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      {text && <p className="mt-2 max-w-sm text-sm text-muted">{text}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/** Price in the visitor's currency; shows the old price when discounted. */
export function Price({ value, compareAt, className, size = 'md', showAlt, from }) {
  const m = useMoney();
  const { t } = useT();
  const big = size === 'lg' ? 'text-3xl' : size === 'xl' ? 'text-4xl' : size === 'sm' ? 'text-sm' : 'text-base';
  return (
    <span className={cx('inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5', className)}>
      {from && <span className="text-xs font-medium text-muted">{t('product.from')}</span>}
      <span dir="ltr" className={cx('font-bold tracking-tight tabular-nums', big)}>
        {m.fmt(value)}
      </span>
      {compareAt > value && (
        <span dir="ltr" className={cx('text-muted line-through tabular-nums', size === 'lg' || size === 'xl' ? 'text-lg' : 'text-[0.8em]')}>
          {m.fmt(compareAt)}
        </span>
      )}
      {showAlt && m.alt(value) && (
        <span dir="ltr" className="basis-full text-xs font-medium text-muted tabular-nums">
          ≈ {m.alt(value)}
        </span>
      )}
    </span>
  );
}

export function Stars({ value = 0, size = 14, className }) {
  return (
    <span className={cx('inline-flex items-center gap-0.5', className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i + 1));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line-strong" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-amber-400" style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

export function Qty({ value, onChange, min = 1, max = 10, size = 'md', className }) {
  const { t } = useT();
  const h = size === 'sm' ? 'h-9' : 'h-11';
  return (
    <div className={cx('inline-flex items-center rounded-full border border-line-strong bg-surface', h, className)}>
      <button type="button" className={cx('grid aspect-square place-items-center rounded-full text-ink transition hover:bg-surface-3 disabled:opacity-30', h)} onClick={() => onChange(Math.max(min - 1, value - 1))} disabled={value <= min - 1} aria-label={t('cart.less')}>
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
      <button type="button" className={cx('grid aspect-square place-items-center rounded-full text-ink transition hover:bg-surface-3 disabled:opacity-30', h)} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={t('cart.more')}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function Segmented({ value, onChange, options, className, size = 'md' }) {
  return (
    <div className={cx('inline-flex rounded-full bg-surface-3 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex items-center gap-1.5 rounded-full font-semibold transition',
            size === 'sm' ? 'h-7 px-3 text-xs' : 'h-9 px-4 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-[var(--shadow-soft)]' : 'text-muted hover:text-ink',
          )}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
          {o.count !== undefined && <span className="text-[11px] opacity-60">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function useCountdown(to) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!to) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [to]);
  if (!to) return null;
  const ms = Math.max(0, new Date(to).getTime() - now);
  return { ms, d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60, s: Math.floor(ms / 1000) % 60 };
}

export function Countdown({ to, className, dark }) {
  const c = useCountdown(to);
  const { t } = useT();
  if (!c || c.ms <= 0) return null;
  const cell = (v, l) => (
    <span className="flex flex-col items-center">
      <span className={cx('min-w-[2.6ch] rounded-lg px-1.5 py-1 text-center font-display text-lg font-bold tabular-nums leading-none', dark ? 'bg-white/10 text-white' : 'bg-inverse text-on-inverse')}>
        {String(v).padStart(2, '0')}
      </span>
      <span className={cx('mt-1 text-[10px] font-semibold uppercase tracking-wider', dark ? 'text-white/50' : 'text-muted')}>{l}</span>
    </span>
  );
  return (
    <span dir="ltr" className={cx('inline-flex items-start gap-1.5', className)}>
      {c.d > 0 && cell(c.d, t('time.d'))}
      {cell(c.h, t('time.h'))}
      {cell(c.m, t('time.m'))}
      {cell(c.s, t('time.s'))}
    </span>
  );
}

/** Image with lazy loading, fade-in and a graceful fallback. `thumb` loads the small version of uploaded photos. */
export function Img({ src, alt = '', className, imgClassName, eager, onLoad, thumb, ...rest }) {
  const [state, setState] = useState('loading');
  const [badThumb, setBadThumb] = useState(null);
  const ref = useRef(null);
  const wanted = thumb ? thumbUrl(src) : src;
  const actual = wanted !== src && badThumb === wanted ? src : wanted; // no small version: use the full photo
  useEffect(() => {
    if (ref.current?.complete && ref.current.naturalWidth) setState('ok');
  }, [actual]);
  return (
    <span className={cx('relative block overflow-hidden', className)}>
      {src && state !== 'error' ? (
        <img
          ref={ref}
          src={assetUrl(actual)}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={(e) => {
            setState('ok');
            onLoad?.(e);
          }}
          onError={() => (actual !== src ? setBadThumb(actual) : setState('error'))}
          className={cx('size-full object-contain transition-opacity duration-500', state === 'ok' ? 'opacity-100' : 'opacity-0', imgClassName)}
          {...rest}
        />
      ) : (
        <span className="grid size-full place-items-center text-faint">
          <svg viewBox="0 0 24 24" className="size-1/4 max-h-10 max-w-10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="6" y="2.5" width="12" height="19" rx="3" />
            <path d="M10.5 18.5h3" />
          </svg>
        </span>
      )}
    </span>
  );
}

export function SectionTitle({ eyebrow, title, action, className, dark }) {
  return (
    <div className={cx('mb-5 flex items-end justify-between gap-4 sm:mb-7', className)}>
      <div className="min-w-0">
        {eyebrow && <p className={cx('eyebrow mb-2', dark ? 'text-white/50' : 'text-muted')}>{eyebrow}</p>}
        <h2 className={cx('font-display text-2xl font-bold tracking-tight sm:text-[32px] sm:leading-tight', dark && 'text-white')}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------------- overlays ----------------
function useLockScroll(active) {
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    const pad = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    if (pad) document.body.style.paddingInlineEnd = `${pad}px`;
    return () => {
      document.body.style.overflow = prev;
      document.body.style.paddingInlineEnd = '';
    };
  }, [active]);
}

function useEscape(active, onClose) {
  useEffect(() => {
    if (!active) return;
    const on = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [active, onClose]);
}

/** Keeps a component mounted during its exit animation. */
export function usePresence(open, ms = 260) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const id = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(id);
  }, [open, ms]);
  return { mounted, visible };
}

export function Modal({ open, onClose, title, children, className, size = 'md', footer, bare }) {
  const { mounted, visible } = usePresence(open);
  useLockScroll(mounted);
  useEscape(open, onClose);
  const id = useId();
  const panel = useRef(null);
  useEffect(() => {
    if (open) setTimeout(() => panel.current?.focus(), 50);
  }, [open]);
  if (!mounted) return null;
  const width = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : size === 'xl' ? 'sm:max-w-5xl' : 'sm:max-w-xl';
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={title ? id : undefined}>
      <div className={cx('absolute inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <div
        ref={panel}
        tabIndex={-1}
        className={cx(
          'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-[var(--shadow-pop)] outline-none transition duration-300 ease-[var(--ease-out-expo)] sm:rounded-[28px]',
          width,
          visible ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-8 opacity-0 sm:scale-95',
          className,
        )}
      >
        {!bare && (
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <h2 id={id} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <IconButton icon={X} label="Close" onClick={onClose} size="sm" />
          </div>
        )}
        <div className={cx('min-h-0 flex-1 overflow-y-auto', !bare && 'px-5 py-5 sm:px-6')}>{children}</div>
        {footer && <div className="border-t border-line px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children, footer, side = 'end', className, width = 'max-w-md' }) {
  const { mounted, visible } = usePresence(open, 320);
  useLockScroll(mounted);
  useEscape(open, onClose);
  if (!mounted) return null;
  const hidden = side === 'end' ? 'ltr:translate-x-full rtl:-translate-x-full' : 'ltr:-translate-x-full rtl:translate-x-full';
  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
      <div className={cx('absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')} onClick={onClose} />
      <aside
        className={cx(
          'absolute top-0 flex h-full w-full flex-col bg-surface shadow-[var(--shadow-pop)] transition-transform duration-300 ease-[var(--ease-out-expo)]',
          side === 'end' ? 'end-0' : 'start-0',
          width,
          visible ? 'translate-x-0' : hidden,
          className,
        )}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="min-w-0 font-display text-lg font-semibold">{title}</div>
            <IconButton icon={X} label="Close" onClick={onClose} size="sm" />
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="safe-bottom border-t border-line bg-surface">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

export function Tabs({ value, onChange, items, className }) {
  return (
    <div className={cx('no-scrollbar flex gap-1 overflow-x-auto border-b border-line', className)}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cx(
            'relative inline-flex shrink-0 items-center gap-2 px-3.5 pb-3 pt-2 text-sm font-semibold transition',
            value === it.value ? 'text-ink' : 'text-muted hover:text-ink',
          )}
        >
          {it.icon && <it.icon className="size-4" />}
          {it.label}
          {it.count !== undefined && it.count !== null && (
            <span className={cx('rounded-full px-1.5 text-[11px] leading-5', value === it.value ? 'bg-inverse text-on-inverse' : 'bg-surface-3 text-muted')}>{it.count}</span>
          )}
          {value === it.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
        </button>
      ))}
    </div>
  );
}

/** Copies text and shows a short "copied" state. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return [copy, copied];
}
