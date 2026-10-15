import { MARK, WORDMARK } from './paths.js';
import { cx } from '../ui.jsx';

/** The SPS mark (vector, follows the text color). */
export function Mark({ className, title = 'SPS' }) {
  return (
    <svg viewBox={`0 0 ${MARK.w} ${MARK.h}`} className={className} fill="currentColor" role="img" aria-label={title}>
      <path fillRule="evenodd" d={MARK.d} />
    </svg>
  );
}

/** Full logo: mark + line + "SMART PHONE STORE" in the original lettering. */
export function Lockup({ className }) {
  const W = WORDMARK;
  return (
    <svg viewBox={`${W.x} ${W.y} ${W.w} ${W.h}`} className={className} fill="currentColor" role="img" aria-label="Smart Phone Store">
      <path fillRule="evenodd" d={MARK.d} />
      <path d={W.line} />
      <path fillRule="evenodd" d={W.text} />
    </svg>
  );
}

/** Horizontal header logo: mark + store name. */
export function Logo({ className, compact }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)} dir="ltr">
      <Mark className="h-7 w-auto shrink-0 sm:h-8" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[13px] font-bold tracking-[0.2em] sm:text-sm">SMART PHONE</span>
          <span className="mt-1 flex items-center gap-1.5 font-display text-[9.5px] font-semibold tracking-[0.42em] text-muted">
            <span className="h-px w-3 bg-current opacity-60" />
            STORE
          </span>
        </span>
      )}
    </span>
  );
}
