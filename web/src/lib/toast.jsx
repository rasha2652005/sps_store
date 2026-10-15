// Toast notifications.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleCheck, CircleX, Info, X } from 'lucide-react';
import { Link } from 'react-router';
import { assetUrl, thumbUrl } from './links.js';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const dismiss = useCallback((id) => setItems((l) => l.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t) => {
      const id = ++seq.current;
      const item = typeof t === 'string' ? { title: t } : t;
      setItems((l) => [...l.slice(-2), { id, tone: 'ok', ...item }]);
      setTimeout(() => dismiss(id), item.duration || 3800);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[90] flex flex-col items-center gap-2 px-3 sm:bottom-6 sm:items-end sm:px-6" aria-live="polite">
        {items.map((t) => {
          const Icon = t.icon || (t.tone === 'error' ? CircleX : t.tone === 'info' ? Info : CircleCheck);
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex w-full max-w-sm animate-[fade-up_0.35s_var(--ease-out-expo)] items-center gap-3 rounded-2xl bg-inverse px-4 py-3 text-on-inverse shadow-[var(--shadow-pop)]"
              role="status"
            >
              {t.image ? (
                <img src={assetUrl(thumbUrl(t.image))} onError={(e) => { if (e.currentTarget.dataset.full !== "1") { e.currentTarget.dataset.full = "1"; e.currentTarget.src = assetUrl(t.image); } }} alt="" className="size-11 shrink-0 rounded-xl bg-white/10 object-contain p-1" />
              ) : (
                <Icon className={`size-5 shrink-0 ${t.tone === 'error' ? 'text-danger' : t.tone === 'info' ? 'opacity-80' : 'text-ok'}`} />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{t.title}</p>
                {t.text && <p className="truncate text-xs opacity-70">{t.text}</p>}
              </div>
              {t.action &&
                (t.action.to ? (
                  <Link to={t.action.to} onClick={() => dismiss(t.id)} className="shrink-0 rounded-full bg-on-inverse/15 px-3 py-1.5 text-xs font-bold hover:bg-on-inverse/25">
                    {t.action.label}
                  </Link>
                ) : (
                  <button
                    onClick={() => {
                      t.action.onClick?.();
                      dismiss(t.id);
                    }}
                    className="shrink-0 rounded-full bg-on-inverse/15 px-3 py-1.5 text-xs font-bold hover:bg-on-inverse/25"
                  >
                    {t.action.label}
                  </button>
                ))}
              <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
