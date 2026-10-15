// In-browser backend for the single-file demo build (`npm run build:demo`).
// The real website talks to the Node server; here the very same API code (core/) runs inside the page on top of
// SQLite compiled to JavaScript (sql.js), and every fetch('/api/...') is answered locally. Data is kept in this
// browser only (IndexedDB), so each visitor gets a private copy of the store to play with.
import initSqlJs from 'sql.js/dist/sql-asm-memory-growth.js';
import { dispatch } from '../../../core/dispatch.js';
import { migrate } from '../../../core/schema.js';
import { seedDemo } from '../../../core/seed/index.js';
import { hashPassword } from '../../../core/auth.js';
import { isoNow } from '../../../core/util.js';

const DEMO_VERSION = '1';
export const DEMO_OWNER = { email: 'owner@sps.demo', password: 'demo1234' };
const JAR_KEY = 'sps:demo:jar';
const APP_KEYS = ['sps:cart', 'sps:wish', 'sps:compare', 'sps:recent', 'sps:checkout', 'sps:searches', 'sps:zone', JAR_KEY];

// ---------------------------------------------------------------- IndexedDB (best effort)
const idb = (() => {
  let dbp = null;
  const open = () =>
    (dbp ||= new Promise((resolve, reject) => {
      const r = indexedDB.open('sps-demo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const run = async (mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction('kv', mode);
      const req = fn(t.objectStore('kv'));
      t.oncomplete = () => resolve(req?.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    get: (k) => run('readonly', (s) => s.get(k)),
    set: (k, v) => run('readwrite', (s) => s.put(v, k)),
    clear: () => run('readwrite', (s) => s.clear()),
  };
})();
const safe = async (p, fallback) => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

// ---------------------------------------------------------------- SQLite adapter (same shape as server/db.js)
function wrapDb(raw, onWrite) {
  const norm = (params) => params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
  const all = (sql, ...p) => {
    const st = raw.prepare(sql);
    try {
      st.bind(norm(p));
      const rows = [];
      while (st.step()) rows.push(st.getAsObject());
      return rows;
    } finally {
      st.free();
    }
  };
  return {
    get: (sql, ...p) => all(sql, ...p)[0],
    all,
    run: (sql, ...p) => {
      const st = raw.prepare(sql);
      try {
        st.bind(norm(p));
        st.step();
      } finally {
        st.free();
      }
      const changes = raw.getRowsModified();
      const id = raw.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0;
      onWrite();
      return { changes, lastInsertRowid: Number(id) };
    },
    exec: (sql) => {
      raw.exec(sql);
      onWrite();
    },
    raw,
  };
}

// ---------------------------------------------------------------- photos kept in the browser
function createAssets(saved) {
  const files = { ...(saved || {}) }; // path -> Blob | svg string
  const urls = new Map();
  const toUrl = (v, type) => URL.createObjectURL(v instanceof Blob ? v : new Blob([v], { type: type || 'image/svg+xml' }));
  for (const [path, v] of Object.entries(files)) urls.set(path, toUrl(v));
  return {
    files,
    resolve: (u) => urls.get(u) || u,
    add(path, value, type) {
      files[path] = value;
      urls.set(path, toUrl(value, type));
      return path;
    },
  };
}

const MAGIC = {
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  webp: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP',
  avif: (b) => String.fromCharCode(...b.slice(4, 8)) === 'ftyp',
};

function createStorage(assets, persistAssets) {
  return {
    dir: null,
    async saveImage(dataUrl, type, as = null) {
      const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      if (!MAGIC[type]?.(bytes)) {
        const { bad } = await import('../../../core/errors.js');
        throw bad('image_invalid', 'This file is not a valid image');
      }
      const ext = type === 'jpeg' ? 'jpg' : type;
      const id = crypto.getRandomValues(new Uint32Array(2)).join('');
      const path = assets.add(as ? `${as}.${ext}` : `/uploads/u/${id}.${ext}`, new Blob([bytes], { type: `image/${type}` }));
      persistAssets();
      return path;
    },
    saveSeedSvg(name, svg) {
      return assets.add(`/uploads/seed/${name}`, svg, 'image/svg+xml');
    },
  };
}

// ---------------------------------------------------------------- cookies (the server uses HttpOnly cookies)
function createJar() {
  let jar = {};
  try {
    jar = JSON.parse(localStorage.getItem(JAR_KEY) || '{}') || {};
  } catch {
    jar = {};
  }
  const save = () => {
    try {
      localStorage.setItem(JAR_KEY, JSON.stringify(jar));
    } catch {
      /* private mode: cookies live until the tab closes */
    }
  };
  return {
    read() {
      const now = Date.now();
      const out = {};
      for (const [k, c] of Object.entries(jar)) {
        if (c.exp > now) out[k] = c.value;
        else delete jar[k];
      }
      return out;
    },
    apply(list) {
      if (!list?.length) return;
      for (const c of list) {
        if (c.maxAge > 0) jar[c.name] = { value: c.value, exp: Date.now() + c.maxAge * 1000 };
        else delete jar[c.name];
      }
      save();
    },
  };
}

// ---------------------------------------------------------------- demo bar (outside React, always visible at the top)
function mountDemoBar(reset) {
  const css = `
  #sps-demo-bar{position:relative;z-index:35;display:flex;align-items:center;justify-content:center;gap:6px 14px;flex-wrap:wrap;
    padding:7px max(16px,env(safe-area-inset-left,0px)) 7px max(16px,env(safe-area-inset-right,0px));
    background:repeating-linear-gradient(-45deg,#ffe14d 0 14px,#ffd60a 14px 28px);color:#0b0b0d;
    font:600 12.5px/1.35 'Manrope Variable','IBM Plex Sans Arabic',system-ui,sans-serif;text-align:center}
  #sps-demo-bar b{font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:11px;background:#0b0b0d;color:#ffe14d;padding:2px 7px;border-radius:999px}
  #sps-demo-bar button{all:unset;cursor:pointer;font-weight:800;text-decoration:underline;text-underline-offset:3px}
  #sps-demo-bar button.go{text-decoration:none;background:#0b0b0d;color:#fff;padding:6px 14px;border-radius:999px;font-size:13px;box-shadow:0 2px 0 rgba(0,0,0,.25)}
  #sps-demo-bar button.go:hover{background:#26262b}
  #sps-demo-bar button:focus-visible{outline:2px solid #0b0b0d;outline-offset:2px;border-radius:999px}
  #sps-demo-bar .short{display:none}
  @media (max-width:640px){#sps-demo-bar .long{display:none}#sps-demo-bar .short{display:inline}}
  html.sps-demo-admin #sps-demo-bar{position:sticky;top:0}
  html.sps-demo-admin [data-admin-sidebar]{top:var(--sps-demo-h,0px)}
  html.sps-demo-admin [data-admin-header]{top:var(--sps-demo-h,0px)}
  @media print{#sps-demo-bar{display:none}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  const bar = document.createElement('div');
  bar.id = 'sps-demo-bar';
  bar.setAttribute('role', 'note');
  document.body.insertBefore(bar, document.body.firstChild);

  const TEXT = {
    en: { tag: 'Demo', msg: 'Preview of your website. Orders placed here are not sent to the shop.', short: 'Orders here are not sent to the shop.', admin: 'Open the admin panel →', adminShort: 'Admin panel →', store: '← Back to the shop', storeShort: '← Shop', reset: 'Reset demo', resetShort: 'Reset', confirm: 'Tap again to reset' },
    ar: { tag: 'تجريبي', msg: 'نسخة تجريبية من موقعك. الطلبات هون ما بتوصل عالمحل.', short: 'الطلبات هون ما بتوصل عالمحل.', admin: 'افتح لوحة التحكم ←', adminShort: 'لوحة التحكم ←', store: '→ رجوع عالمتجر', storeShort: '→ المتجر', reset: 'إعادة ضبط', resetShort: 'إعادة ضبط', confirm: 'كبوس كمان مرة' },
  };
  let armed = false;
  let timer = null;
  const twoSizes = (el, long, short) => {
    const a = document.createElement('span');
    a.className = 'long';
    a.textContent = long;
    const b = document.createElement('span');
    b.className = 'short';
    b.textContent = short;
    el.append(a, b);
    return el;
  };
  const measure = () => document.documentElement.style.setProperty('--sps-demo-h', `${bar.offsetHeight}px`);
  const render = () => {
    const t = TEXT[document.documentElement.lang === 'ar' ? 'ar' : 'en'];
    const inAdmin = location.hash.startsWith('#/admin');
    document.documentElement.classList.toggle('sps-demo-admin', inAdmin);
    bar.innerHTML = '';
    const tag = document.createElement('b');
    tag.textContent = t.tag;
    bar.append(tag, twoSizes(document.createElement('span'), t.msg, t.short));
    // Big, obvious switch between the shop and the admin panel (goes through the app's router).
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'go';
    go.dataset.demoGo = inAdmin ? 'store' : 'admin';
    twoSizes(go, inAdmin ? t.store : t.admin, inAdmin ? t.storeShort : t.adminShort);
    go.onclick = () => {
      const to = inAdmin ? '/' : '/admin';
      if (window.__SPS_NAVIGATE__) window.__SPS_NAVIGATE__(to);
      else location.hash = `#${to}`;
      window.scrollTo(0, 0);
    };
    bar.append(go);
    const btn = document.createElement('button');
    btn.type = 'button';
    if (armed) btn.textContent = t.confirm;
    else twoSizes(btn, t.reset, t.resetShort);
    btn.onclick = () => {
      if (!armed) {
        armed = true;
        render();
        clearTimeout(timer);
        timer = setTimeout(() => {
          armed = false;
          render();
        }, 4000);
        return;
      }
      reset();
    };
    bar.append(btn);
    measure();
  };
  render();
  new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('hashchange', render);
  window.addEventListener('popstate', render);
  // The router changes pages with history.pushState, which fires no event: announce it so the bar can follow.
  for (const method of ['pushState', 'replaceState']) {
    const original = history[method];
    history[method] = function (...args) {
      const out = original.apply(this, args);
      queueMicrotask(render);
      return out;
    };
  }
  window.addEventListener('resize', measure);
}

// ---------------------------------------------------------------- install
export async function install() {
  window.__SPS_DEMO__ = true;
  // `#admin` from a shared link opens the admin panel (only plain #words survive in shared links).
  if (location.hash === '#admin') {
    try {
      history.replaceState(null, '', '#/admin');
    } catch {
      location.hash = '#/admin';
    }
  }

  const SQL = await initSqlJs();
  const fresh = (await safe(idb.get('version'), null)) !== DEMO_VERSION;
  const savedDb = fresh ? null : await safe(idb.get('db'), null);
  const savedAssets = fresh ? null : await safe(idb.get('assets'), null);
  if (fresh) {
    for (const k of APP_KEYS) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
  }

  // Save after changes, outside of any request (core's transactions are synchronous, so they never span a save).
  let saveTimer = null;
  let resetting = false;
  let raw = null;
  const persist = async () => {
    saveTimer = null;
    if (resetting) return;
    try {
      const bytes = raw.export();
      raw.exec('PRAGMA foreign_keys = ON'); // export() reopens the database and resets pragmas
      await idb.set('db', bytes);
      await idb.set('version', DEMO_VERSION);
    } catch {
      /* storage unavailable: the demo keeps working in memory for this visit */
    }
  };
  const schedule = () => {
    if (!saveTimer && !resetting) saveTimer = setTimeout(persist, 600);
  };

  raw = savedDb ? new SQL.Database(savedDb) : new SQL.Database();
  const db = wrapDb(raw, schedule);
  const assets = createAssets(savedAssets);
  const persistAssets = () => safe(idb.set('assets', assets.files));
  const storage = createStorage(assets, persistAssets);
  migrate(db);

  if (!savedDb) {
    seedDemo(db, { saveSvg: (name, svg) => storage.saveSeedSvg(name, svg), extras: true });
    db.run(
      "INSERT INTO admins (name, email, password_hash, role, created_at) VALUES ('SPS Admin', ?, ?, 'owner', ?)",
      DEMO_OWNER.email,
      await hashPassword(DEMO_OWNER.password, 20000),
      isoNow(),
    );
    await persistAssets();
    await persist();
  }

  window.__SPS_ASSET__ = assets.resolve;
  const jar = createJar();

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const href = typeof input === 'string' ? input : input?.url || String(input);
    let url;
    try {
      url = new URL(href, location.href);
    } catch {
      return realFetch(input, init);
    }
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, init);
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let body = null;
    if (typeof init.body === 'string' && init.body) {
      try {
        body = JSON.parse(init.body);
      } catch {
        return new Response(JSON.stringify({ error: { code: 'bad_json', message: 'Invalid request' } }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }
    const out = await dispatch(
      { method: (init.method || 'GET').toUpperCase(), path: url.pathname, query: Object.fromEntries(url.searchParams), body, cookies: jar.read(), ip: 'demo' },
      { db, storage, demo: true, prod: false, log: (e) => console.error(e) },
    );
    jar.apply(out.cookies);
    if (out.raw) return new Response(out.raw.body, { status: out.status, headers: { 'Content-Type': out.raw.type } });
    return new Response(JSON.stringify(out.json), { status: out.status, headers: { 'Content-Type': 'application/json' } });
  };

  window.addEventListener('pagehide', () => {
    if (saveTimer && !resetting) {
      clearTimeout(saveTimer);
      persist();
    }
  });

  mountDemoBar(async () => {
    resetting = true; // block further saves while we wipe
    clearTimeout(saveTimer);
    await safe(idb.clear());
    for (const k of APP_KEYS) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    }
    location.hash = '#/';
    location.reload();
  });
}
