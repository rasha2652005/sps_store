# Smart Phone Store (SPS)

Online shop for **Smart Phone Store**: a customer website (English + Arabic), an admin panel to run the shop, and the backend that stores products, orders and customers.

- WhatsApp / phone: **+961 81 078 452**
- Instagram: **@sps_mob**

---

## What's inside

**Customer website**
- Home page with banners, categories, deals, best sellers, used phones and trade-in.
- Smart search: understands Arabic and English ("ايفون 17 برو", "كفر", "شريط شحن"), spelling mistakes ("samsng s25"), and suggests matching accessories.
- Product pages with colors, storage options, live stock ("Only 3 left"), specs, compatible accessories, compare and wishlist.
- Accessory finder: pick your phone and see the cases, glass and chargers that fit it.
- Cart and checkout in one page: delivery all over Lebanon with a fee per area (free above $100), store pickup, cash on delivery, Whish Money and OMT, discount codes.
- Order page with live status, "send order on WhatsApp", order tracking by number + phone, cancel while still pending.
- Customer accounts (optional): saved addresses, order history, password reset by the shop.
- Prices in USD with the LBP amount; LBP display mode; light / dark mode; works great on phones.
- Trade-in requests and "tell me when it's back in stock" alerts.
- SEO: page titles, Google product data, sitemap and WhatsApp/Facebook link previews.

**Admin panel** (`/admin`)
- Dashboard: today's sales, orders waiting, revenue chart, best sellers, stock running low, what people search for.
- Orders: filter and search, one-click next step (Confirm → Out for delivery → Delivered), payment status, ready-made WhatsApp messages in the customer's language, printable invoice, CSV export, sound + notification when a new order arrives.
- Products: photos (drag & drop, resized automatically, one photo per color), colors × storage options in one click, prices / old prices / stock per option, specs, compatible phones, live preview.
- Categories & brands, customers, reviews, discount codes, trade-in and back-in-stock requests.
- Settings: store info, delivery areas and fees, payment methods, LBP rate, home page banners, the 4 promises under the banner, policies (warranty, returns, delivery), team accounts (owner / staff), backup download.

---

## Try it on your computer

You need **Node.js 22.13 or newer** (download from nodejs.org).

```bash
npm install
npm run build
npm start
```

Open http://localhost:3000 for the shop and http://localhost:3000/admin to create the owner account.

The shop starts with example products (placeholder photos) so you can see how everything looks. Replace them with your real products, then remove the examples from **Admin → Settings → Backup & demo data**.

To also get example orders and customers (handy to explore the admin), start with `SEED_DEMO_EXTRAS=true` on an empty `data` folder.

---

## Put it online for free (GitHub + Turso + Render)

Three free accounts, about 20 minutes. No credit card needed.

- **GitHub** keeps the code.
- **Turso** keeps the data: products, orders, customers and photos (free plan: 5 GB).
- **Render** runs the website (free plan).

Limits of the free plan: the website sleeps after 15 minutes without visitors, and the first visitor after that waits about a minute while it wakes up (step 5 keeps it awake). Render's free plan also includes a limited amount of traffic per month (see render.com/pricing). Product lists load small versions of the photos to save it. When the shop gets busy, upgrade with one click (step 6): nothing else changes.

1. **GitHub.** Create an account at github.com → **New repository** → name it `sps-store` → **Private** → create. Click **uploading an existing file** and drag the files and folders of this project (not `node_modules`, `dist` or `data`). The upload page takes up to 100 files at a time, so drag the `web` folder first and commit, then drag everything else and commit again. The free GitHub Desktop app also works, without that limit.
2. **Turso.** Sign up at turso.tech (**Continue with GitHub**). Create a database (name `sps`, location closest to Lebanon, for example Frankfurt). On the database page, copy its **URL** (starts with `libsql://`), then create a **token** and copy it too.
3. **Render.** Sign up at render.com (**GitHub**). Click **New** → **Blueprint** → choose `sps-store`. Render reads `render.yaml` and asks for 4 values:
   - `TURSO_DATABASE_URL`: the Turso URL
   - `TURSO_AUTH_TOKEN`: the Turso token
   - `ADMIN_EMAIL`: your email (to log in to the admin)
   - `ADMIN_PASSWORD`: a strong password (at least 8 characters)

   Click **Apply** and wait for **Live** (a few minutes).
4. **Open your shop** at the address Render shows (like `https://smart-phone-store.onrender.com`). Add `/admin` to log in.
5. **Keep it awake (optional).** At cron-job.org (free), create a job that opens `https://YOUR-ADDRESS.onrender.com/healthz` every 10 minutes. One website running all month fits in Render's free hours.
6. **Later:**
   - **Upgrade:** Render → your service → **Settings → Instance Type → Starter** (paid monthly). The site never sleeps and gets more traffic. Your data stays in Turso.
   - **Your own domain** (for example `spslebanon.com`): buy it from Namecheap, GoDaddy or Cloudflare. In Render → **Settings → Custom Domains**, add it and copy the DNS records into your domain provider. Then add `PUBLIC_URL` = `https://your-domain.com` in Render → **Environment**.

Every time you change the code on GitHub, Render rebuilds and publishes it automatically. The data is safe in Turso: the shop downloads it when it starts and saves every change back within seconds.

**Other hosts:** any server with Docker works (`docker build -t sps . && docker run -p 3000:3000 -v sps-data:/data sps`). On a host with a permanent disk you don't need Turso: set `DATA_DIR` to a folder on that disk.

## First things to set in the admin

1. **Settings → Store**: address, opening hours, Google Maps link, phone and Instagram.
2. **Settings → Delivery**: areas and fees, free delivery amount, delivery times.
3. **Settings → Payments**: Whish and OMT account numbers and names.
4. **Settings → Currency**: today's LBP rate.
5. **Settings → Policies** and **Home page → the 4 promises**: make sure warranty, exchange and delivery promises match what the shop really offers.
6. **Products**: add your real products and photos (white or light backgrounds look best), prices and stock.
7. **Settings → Team**: add staff accounts. Staff can handle orders and products; only the owner can change settings, codes and team.

## Daily use

- New order → you hear a sound and see it on top of **Orders**. Call or WhatsApp the customer with one tap, then press **Confirm order**.
- When the driver leaves press **Out for delivery**, when the customer receives it press **Delivered**. The customer sees each step on their order page.
- Whish / OMT: when the money arrives, set the order to **Paid**.
- Stock goes down automatically with each order and comes back if an order is cancelled.

## Backups

**Admin → Settings → Backup & demo data → Download backup** saves a full copy of the database (orders, products, customers, settings). Keep one every week in Google Drive or your email.

With Turso (free hosting), every change is also saved there automatically, and the last 3 copies are kept.

To restore a downloaded backup on a server with its own disk: stop the shop, replace `store.db` in the data folder with the backup file, start again.

## Forgot the admin password?

In Render → your service → **Environment**: set `ADMIN_PASSWORD` to a new password and add `ADMIN_RESET_PASSWORD` = `true`, then save (the shop restarts in a minute). Log in with the new password, then delete `ADMIN_RESET_PASSWORD`.

On your own server you can also run: `npm run create-admin -- you@example.com "new password" "Your name"`

---

## For developers

| Command | What it does |
| --- | --- |
| `npm run dev` | API on :3001 + Vite with hot reload on http://localhost:5173 |
| `npm run build` | Builds the website into `dist/` |
| `npm start` | Runs the shop (API + website) on `PORT` (default 3000) |
| `npm test` | API tests (search, checkout, stock, accounts, admin permissions, coupons) |
| `npm run build:demo` | One self-contained HTML file with the backend running in the browser (preview only) |
| `npm run check:i18n` | Checks every text exists in English and Arabic |

**Stack:** Node.js 22 (Express 5, built-in SQLite `node:sqlite`, no native modules), React 19 + React Router 7, Vite 8, Tailwind CSS 4.

```
core/      shared backend: database schema, search engine, pricing, orders, API routes (runs on the server and in the demo)
server/    Express server, database file, photo uploads, SEO tags
web/       the website and admin panel (React)
  src/pages/    customer pages        src/admin/   admin panel
  src/i18n/     English + Arabic texts (edit wording here)
tests/     API tests
brand/     SPS logo files
```

**Environment variables:** see `.env.example` (copy it to `.env` for local use).

**Security:** passwords hashed with PBKDF2-SHA256, HttpOnly session cookies, CSRF protection on every change, strict Content-Security-Policy, rate-limited logins, staff vs owner permissions, uploads checked to be real images.
