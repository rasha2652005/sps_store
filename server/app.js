// Express app: security headers, the JSON API (core/routes.js), product photos, the built website and SEO tags.
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { dispatch } from '../core/dispatch.js';
import { getCatalog } from '../core/catalog.js';
import { getSettings } from '../core/settings.js';
import { AUTH, readSession } from '../core/auth.js';
import { requestContext } from './context.js';

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createApp({ db, storage, distDir, prod = false, publicUrl = '', log = console.error, onEvent, remote = null }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'font-src': ["'self'", 'data:'],
          'connect-src': ["'self'"],
          'frame-ancestors': ["'none'"],
          'form-action': ["'self'"],
          'upgrade-insecure-requests': prod ? [] : null,
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: prod ? undefined : false,
    }),
  );
  app.use(compression());

  app.get('/healthz', (req, res) => res.type('text').send('ok'));

  // ---------------- API ----------------
  app.use('/api', express.json({ limit: '9mb' }));
  app.use('/api', (req, res, next) => {
    // Cross-site request protection: browsers cannot add this header from another site without CORS approval.
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.get('x-sps') !== '1') {
      return res.status(403).json({ error: { code: 'bad_origin', message: 'Request blocked' } });
    }
    res.set('Cache-Control', 'no-store');
    next();
  });
  // Owner-only: download a complete copy of the database (orders, products, customers, settings).
  app.get('/api/admin/backup', async (req, res) => {
    const token = parseCookies(req.headers.cookie)[AUTH.cookie.admin];
    const admin = token ? await readSession(db, 'admin', token) : null;
    if (!admin) return res.status(401).json({ error: { code: 'admin_login_required', message: 'Please log in to the admin panel' } });
    if (admin.role !== 'owner') return res.status(403).json({ error: { code: 'owner_only', message: 'Only the store owner can download backups' } });
    const file = join(tmpdir(), `sps-backup-${process.pid}-${Date.now()}.db`);
    try {
      db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    } catch (e) {
      log(e);
      return res.status(500).json({ error: { code: 'server_error', message: 'Could not create the backup' } });
    }
    res.download(file, `sps-backup-${new Date().toISOString().slice(0, 10)}.db`, () => {
      try {
        unlinkSync(file);
      } catch {
        /* already gone */
      }
    });
  });

  app.use('/api', async (req, res) => {
    const important = req.method !== 'GET' && req.method !== 'HEAD';
    const out = await requestContext.run({ important }, () =>
      dispatch(
        {
          method: req.method,
          path: `/api${req.path}`,
          query: req.query,
          body: req.body,
          cookies: parseCookies(req.headers.cookie),
          ip: req.ip,
        },
        { db, storage, prod, log, emit: onEvent },
      ),
    );
    for (const c of out.cookies || []) {
      if (c.maxAge > 0) {
        res.cookie(c.name, c.value, { httpOnly: true, sameSite: 'lax', secure: prod, path: '/', maxAge: c.maxAge * 1000 });
      } else res.clearCookie(c.name, { httpOnly: true, sameSite: 'lax', secure: prod, path: '/' });
    }
    if (out.raw) {
      res.status(out.status).type(out.raw.type);
      if (out.raw.filename) res.attachment(out.raw.filename);
      return res.send(out.raw.body);
    }
    res.status(out.status).json(out.json);
  });
  // JSON parse errors and other API errors
  app.use('/api', (err, req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: 'Upload is too big' } });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Invalid request' } });
    next(err);
  });

  // ---------------- product photos ----------------
  // Photos that are not on this server's disk yet (fresh start on a host without a permanent disk) are fetched
  // from the backup the first time someone asks for them.
  if (remote) {
    app.use('/uploads', async (req, res, next) => {
      try {
        const rel = decodeURIComponent(req.path);
        if (!/^\/[\w./-]+$/.test(rel) || rel.includes('..')) return next();
        const file = join(storage.dir, rel);
        if (!existsSync(file)) {
          const saved = await remote.getFile(`/uploads${rel}`);
          if (saved) {
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, saved.data);
          }
        }
      } catch (e) {
        log(e);
      }
      next();
    });
  }
  app.use(
    '/uploads',
    express.static(storage.dir, {
      maxAge: '365d',
      immutable: true,
      fallthrough: false,
      setHeaders: (res) => {
        res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        res.set('X-Content-Type-Options', 'nosniff');
        res.set('Cross-Origin-Resource-Policy', 'same-site');
      },
    }),
  );

  // ---------------- SEO helpers ----------------
  const origin = (req) => publicUrl || `${req.protocol}://${req.get('host')}`;

  app.get('/robots.txt', (req, res) => {
    res.type('text').send(
      ['User-agent: *', 'Disallow: /admin', 'Disallow: /account', 'Disallow: /checkout', 'Disallow: /cart', 'Disallow: /order/', `Sitemap: ${origin(req)}/sitemap.xml`, ''].join('\n'),
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const cat = getCatalog(db);
    const o = origin(req);
    const urls = [
      { loc: '/', pr: '1.0' },
      { loc: '/shop', pr: '0.8' },
      { loc: '/deals', pr: '0.7' },
      ...cat.categories.filter((c) => c.count).map((c) => ({ loc: `/c/${c.slug}`, pr: '0.7' })),
      ...cat.brands.filter((b) => b.count).map((b) => ({ loc: `/b/${b.slug}`, pr: '0.6' })),
      ...cat.products.map((p) => ({ loc: `/product/${p.slug}`, pr: '0.9', mod: p.created_at })),
    ];
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls.map((u) => `  <url><loc>${esc(o + u.loc)}</loc>${u.mod ? `<lastmod>${u.mod.slice(0, 10)}</lastmod>` : ''}<priority>${u.pr}</priority></url>`).join('\n') +
        `\n</urlset>\n`,
    );
  });

  // ---------------- the website (built by Vite) ----------------
  const indexFile = join(distDir, 'index.html');
  let template = null;
  let templateMtime = 0;
  // Re-reads index.html when a new build replaces it (no restart needed after "npm run build").
  const getTemplate = () => {
    try {
      const m = statSync(indexFile).mtimeMs;
      if (m !== templateMtime) {
        template = readFileSync(indexFile, 'utf8');
        templateMtime = m;
      }
    } catch {
      template = null;
    }
    return template;
  };

  app.use(
    express.static(distDir, {
      index: false,
      setHeaders: (res, path) => {
        if (path.includes(`${join('assets', '')}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }),
  );

  function headFor(req) {
    const s = getSettings(db);
    const store = s.store;
    const o = origin(req);
    const path = req.path;
    let title = `${store.name_en} — ${store.tagline_en}`;
    let desc = `${store.tagline_en}. ${store.name_en}: phones, accessories, delivery all over Lebanon, cash on delivery.`;
    let image = `${o}/brand/og-image.png`;
    let jsonld = {
      '@context': 'https://schema.org',
      '@type': 'Store',
      name: store.name_en,
      url: o,
      telephone: store.phone,
      address: store.address_en,
      logo: `${o}/brand/icon-512.png`,
    };
    let robots = 'index, follow';
    const m = /^\/product\/([^/]+)/.exec(path);
    const c = /^\/c\/([^/]+)/.exec(path);
    const b = /^\/b\/([^/]+)/.exec(path);
    if (m) {
      const p = getCatalog(db).bySlug.get(decodeURIComponent(m[1]));
      if (p) {
        title = `${p.name.en}${p.subtitle.en ? ` — ${p.subtitle.en}` : ''} | ${store.name_en}`;
        desc = (p.description.en || p.subtitle.en || p.name.en).slice(0, 180);
        const img = p.images.find((i) => !i.url.endsWith('.svg'))?.url;
        if (img) image = img.startsWith('http') ? img : o + img;
        jsonld = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: p.name.en,
          description: desc,
          sku: p.variants[0]?.sku || undefined,
          brand: p.brand ? { '@type': 'Brand', name: p.brand.name } : undefined,
          image: p.images.slice(0, 3).map((i) => (i.url.startsWith('http') ? i.url : o + i.url)),
          itemCondition: p.condition === 'new' ? 'https://schema.org/NewCondition' : p.condition === 'used' ? 'https://schema.org/UsedCondition' : 'https://schema.org/RefurbishedCondition',
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'USD',
            lowPrice: p.price_min,
            highPrice: p.price_max,
            availability: p.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `${o}/product/${p.slug}`,
          },
          aggregateRating: p.rating.count ? { '@type': 'AggregateRating', ratingValue: p.rating.avg, reviewCount: p.rating.count } : undefined,
        };
      }
    } else if (c || b) {
      const cat = getCatalog(db);
      const item = c ? cat.categories.find((x) => x.slug === c[1]) : cat.brands.find((x) => x.slug === b[1]);
      if (item) {
        const name = c ? item.name.en : item.name;
        title = `${name} | ${store.name_en}`;
        desc = `Shop ${name} at ${store.name_en}. Delivery all over Lebanon, cash on delivery.`;
      }
    } else if (/^\/(admin|account|checkout|cart|order)/.test(path)) {
      robots = 'noindex, nofollow';
    }
    return (
      `<title>${esc(title)}</title>` +
      `<meta name="description" content="${esc(desc)}">` +
      `<meta name="robots" content="${robots}">` +
      `<link rel="canonical" href="${esc(o + path)}">` +
      `<meta property="og:type" content="${m ? 'product' : 'website'}">` +
      `<meta property="og:site_name" content="${esc(store.name_en)}">` +
      `<meta property="og:title" content="${esc(title)}">` +
      `<meta property="og:description" content="${esc(desc)}">` +
      `<meta property="og:image" content="${esc(image)}">` +
      `<meta property="og:url" content="${esc(o + path)}">` +
      `<meta name="twitter:card" content="summary_large_image">` +
      `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`
    );
  }

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return res.status(404).type('text').send('Not found');
    const tpl = getTemplate();
    if (!tpl) return res.status(503).type('text').send('The website is not built yet. Run "npm run build" first.');
    const html = tpl.replace(/<title>[\s\S]*?<\/title>/, headFor(req));
    res.set('Cache-Control', 'no-cache');
    if (req.path.startsWith('/admin')) res.set('X-Robots-Tag', 'noindex, nofollow');
    res.type('html').send(html);
  });

  app.use((err, req, res, next) => {
    log(err);
    if (res.headersSent) return next(err);
    res.status(err.status || 500).type('text').send(err.status === 404 ? 'Not found' : 'Server error');
  });

  return { app };
}
