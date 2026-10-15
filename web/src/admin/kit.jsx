// Shared admin helpers: status colors, page header, data table, pagination, charts, confirm dialog.
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Button, Modal, cx } from '../components/ui.jsx';
import { useT } from '../lib/prefs.jsx';

export const STATUS_TONES = { pending: 'warn', confirmed: 'info', shipped: 'info', ready: 'info', delivered: 'ok', cancelled: 'danger' };
export const STATUS_DOT = { pending: '#f59e0b', confirmed: '#3b82f6', shipped: '#8b5cf6', ready: '#06b6d4', delivered: '#10b981', cancelled: '#e11d48' };

export function StatusBadge({ status, pickup }) {
  const { t } = useT();
  return (
    <Badge tone={STATUS_TONES[status] || 'neutral'}>
      <span className="size-1.5 rounded-full bg-current" />
      {status === 'delivered' && pickup ? t('order.statuses.picked') : t(`order.statuses.${status}`)}
    </Badge>
  );
}

export function PayBadge({ status }) {
  const { t } = useT();
  return <Badge tone={status === 'paid' ? 'ok' : status === 'refunded' ? 'neutral' : 'outline'}>{t(`order.${status}`)}</Badge>;
}

export function PageHeader({ title, subtitle, actions, back }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back}
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, pad = true }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-display text-base font-bold">{title}</h2>
          {action}
        </div>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

export function Pager({ page, pages, onPage }) {
  const { t } = useT();
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-3 text-sm">
      <span className="text-muted">
        {page} / {pages}
      </span>
      <Button size="xs" variant="outline" icon={ChevronLeft} className="[&_svg]:rtl:-scale-x-100" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t('admin.prev')} />
      <Button size="xs" variant="outline" icon={ChevronRight} className="[&_svg]:rtl:-scale-x-100" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t('admin.next')} />
    </div>
  );
}

export function Confirm({ open, title, text, confirmLabel, onConfirm, onClose, danger = true, busy }) {
  const { t } = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel || t('common.delete')}
          </Button>
        </div>
      }
    >
      {text && <p className="text-sm text-muted">{text}</p>}
    </Modal>
  );
}

// ---------------- charts (SVG, no library) ----------------
export function Sparkline({ values, className, color = 'currentColor' }) {
  const w = 120;
  const h = 36;
  const id = useMemo(() => `sp${Math.random().toString(36).slice(2, 8)}`, []);
  if (!values?.length) return null;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, h - (v / max) * (h - 4) - 2]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.25" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${w} ${h}L0 ${h}Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Revenue area chart + order bars with hover tooltip. */
export function SalesChart({ series, money, labelFor }) {
  const { date } = useT();
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const W = 800;
  const H = 260;
  const P = { l: 8, r: 8, t: 16, b: 28 };
  const n = series.length;
  const maxR = Math.max(1, ...series.map((s) => s.revenue));
  const maxO = Math.max(1, ...series.map((s) => s.orders));
  const x = (i) => P.l + (i / Math.max(1, n - 1)) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - v / maxR) * (H - P.t - P.b);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s.revenue).toFixed(1)}`).join('');
  const bw = Math.max(2, ((W - P.l - P.r) / n) * 0.5);
  const onMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    let px = ((e.clientX - r.left) / r.width) * W;
    if (document.documentElement.dir === 'rtl') px = W - px;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  const ticks = [0, 0.5, 1].map((f) => maxR * f);
  return (
    <div className="relative" dir="ltr">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-64 w-full" preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="rev" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--ink)" stopOpacity="0.18" />
            <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v, i) => (
          <line key={i} x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        ))}
        {series.map((s, i) => (
          <rect key={i} x={x(i) - bw / 2} width={bw} y={H - P.b - (s.orders / maxO) * (H - P.t - P.b) * 0.45} height={(s.orders / maxO) * (H - P.t - P.b) * 0.45} rx="2" fill="var(--hot)" opacity={hover === i ? 0.7 : 0.25} />
        ))}
        <path d={`${line}L${x(n - 1)} ${H - P.b}L${x(0)} ${H - P.b}Z`} fill="url(#rev)" />
        <path d={line} fill="none" stroke="var(--ink)" strokeWidth="2.2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--ink)" strokeOpacity="0.25" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(series[hover].revenue)} r="5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        {[0, Math.floor(n / 2), n - 1].map((i) => (
          <span key={i}>{series[i] ? date(series[i].date + 'T12:00:00', { day: 'numeric', month: 'short' }) : ''}</span>
        ))}
      </div>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-inverse px-3 py-2 text-xs text-on-inverse shadow-[var(--shadow-pop)]"
          style={{ left: `${(x(hover) / W) * 100}%` }}
        >
          <p className="font-semibold opacity-70">{date(series[hover].date + 'T12:00:00', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          <p className="text-sm font-bold">{money(series[hover].revenue)}</p>
          <p className="opacity-70">{labelFor(series[hover].orders)}</p>
        </div>
      )}
    </div>
  );
}

export function Donut({ data, size = 140, thickness = 18, center }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        {data.map((d) => {
          const len = (d.value / total) * c;
          const el = <circle key={d.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-acc} strokeLinecap="butt" />;
          acc += len;
          return el;
        })}
      </svg>
      {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
}

export function Bar({ value, max, color = 'var(--ink)' }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-3">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${max ? Math.max(3, (value / max) * 100) : 0}%`, background: color }} />
    </div>
  );
}

/** Plays a short "ding" with Web Audio (no file needed). */
export function ding() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 0.55);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio not available */
  }
}

/** Resizes an image file in the browser and returns a WebP/JPEG data URL (keeps uploads small). */
export function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let data = canvas.toDataURL('image/webp', 0.86);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.88);
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

export { storeHref } from '../lib/links.js';

/** WhatsApp link to a customer's phone. */
export const waTo = (phone, text) => {
  const n = String(phone || '').replace(/\D/g, '');
  return n ? `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ''}` : null;
};
