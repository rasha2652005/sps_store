// Tiny API client + data hook with an in-memory cache (stale-while-revalidate).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-SPS': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError(0, 'network', 'No connection');
  }
  const type = res.headers.get('content-type') || '';
  const data = type.includes('application/json') ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error?.code || 'error', data?.error?.message, data?.error?.details);
  return data;
}

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '' || v === false) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ---------------- cache ----------------
const cache = new Map(); // key -> { data, error, ts, promise }
const listeners = new Set();
let version = 0;
const notify = () => {
  version++;
  listeners.forEach((l) => l());
};

function load(key) {
  const entry = cache.get(key) || {};
  if (entry.promise) return entry.promise;
  const promise = api(key)
    .then((data) => {
      cache.set(key, { data, error: null, ts: Date.now() });
      notify();
      return data;
    })
    .catch((error) => {
      cache.set(key, { data: entry.data, error, ts: Date.now() });
      notify();
      throw error;
    });
  cache.set(key, { ...entry, promise });
  return promise;
}

export function prefetch(key) {
  const e = cache.get(key);
  if (!e || (!e.promise && Date.now() - e.ts > 30000)) load(key).catch(() => {});
}

/** Marks cached responses whose key starts with one of the prefixes as stale (they refetch when used). */
export function invalidate(...prefixes) {
  for (const k of cache.keys()) if (prefixes.some((p) => k.startsWith(p))) cache.get(k).ts = 0;
  notify();
}

export function setCache(key, data) {
  cache.set(key, { data, error: null, ts: Date.now() });
  notify();
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/**
 * useApi('/api/products?x=1') -> { data, error, loading, reload }
 * Keeps showing the previous data of the same "group" while the next key loads (no flashing on filter changes).
 */
export function useApi(key, { ttl = 30000, keep = true } = {}) {
  useSyncExternalStore(subscribe, () => version);
  const last = useRef(undefined);
  const entry = key ? cache.get(key) : null;
  const stale = !entry || (!entry.promise && Date.now() - entry.ts > ttl);
  useEffect(() => {
    if (key && stale && !cache.get(key)?.promise) load(key).catch(() => {});
  }, [key, stale]);
  if (entry?.data !== undefined) last.current = entry.data;
  const data = entry?.data !== undefined ? entry.data : keep ? last.current : undefined;
  const reload = useCallback(() => (key ? load(key) : Promise.resolve()), [key]);
  return {
    data,
    error: entry?.error || null,
    loading: !!key && (!entry || !!entry.promise) && entry?.data === undefined,
    refreshing: !!entry?.promise,
    reload,
  };
}

/** Wraps an async action with loading/error state. */
export function useAction(fn) {
  const [state, setState] = useState({ loading: false, error: null });
  const run = useCallback(
    async (...args) => {
      setState({ loading: true, error: null });
      try {
        const out = await fn(...args);
        setState({ loading: false, error: null });
        return out;
      } catch (e) {
        setState({ loading: false, error: e });
        throw e;
      }
    },
    [fn],
  );
  return [run, state];
}
