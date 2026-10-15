import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { readFileSync, writeFileSync } from 'node:fs';

// `npm run build`      -> dist/       the real website, served by the Node server
// `npm run build:demo` -> dist-demo/  one self-contained HTML file with an in-browser backend (for previews)
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo';
  return {
    root: 'web',
    publicDir: demo ? false : 'public',
    plugins: [
      react(),
      tailwindcss(),
      demo && viteSingleFile({ removeViteModuleLoader: true }),
      demo && {
        name: 'sps-demo-html',
        transformIndexHtml(html) {
          const boot = readFileSync('web/public/boot.js', 'utf8');
          const icon = readFileSync('web/public/brand/favicon.svg', 'utf8');
          // Shown while the in-page backend starts (replaced by the app on first render).
          const splash = `<div id="sps-splash" role="status" aria-label="Loading"><span>${icon.replace('<svg ', '<svg class="sps-splash-mark" ')}</span></div>`;
          const splashCss = `<style>#sps-splash{min-height:100dvh;display:grid;place-items:center;background:var(--bg,#f2f2f4)}
.sps-splash-mark{width:64px;height:64px;border-radius:16px;animation:sps-pulse 1.1s ease-in-out infinite alternate}
@keyframes sps-pulse{from{transform:scale(.94);opacity:.65}to{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.sps-splash-mark{animation:none}}</style>`;
          return html
            .replace('<script src="/boot.js"></script>', `<script>${boot}</script>${splashCss}`)
            .replace(/<link rel="(icon|apple-touch-icon|manifest)"[^>]*>\s*/g, '')
            .replace('</head>', `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}"></head>`)
            .replace('<div id="root"></div>', `<div id="root">${splash}</div>`);
        },
        // The artifact host wraps pages in its own <html>/<head>/<body>, so also write a version without them.
        closeBundle() {
          let html;
          try {
            html = readFileSync('dist-demo/index.html', 'utf8');
          } catch {
            return;
          }
          const title = html.match(/<title>[\s\S]*?<\/title>/)?.[0] || '<title>Smart Phone Store</title>';
          const fragment = html
            .replace(/<!doctype html>/i, '')
            .replace(/<html[^>]*>|<\/html>|<head>|<\/head>|<body>|<\/body>/gi, '')
            .replace(/<meta charset="[^"]*"\s*\/?>/i, '')
            .replace(/<meta name="viewport"[^>]*>/i, '')
            .replace(title, '')
            .trim();
          writeFileSync('dist-demo/smart-phone-store.html', `${title}\n${fragment}\n`);
        },
      },
    ].filter(Boolean),
    define: { __DEMO__: JSON.stringify(demo) },
    build: {
      outDir: demo ? '../dist-demo' : '../dist',
      emptyOutDir: true,
      assetsInlineLimit: demo ? 100000000 : 4096,
      chunkSizeWarningLimit: 4000,
      target: 'es2020',
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3001',
        '/uploads': 'http://localhost:3001',
      },
    },
  };
});
