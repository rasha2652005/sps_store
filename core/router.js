// Minimal router shared by the Express server and the in-browser demo.
// A handler is `async (ctx) => data`; returning { $raw: { type, body, filename } } sends a non-JSON body.

export function compilePath(path) {
  const keys = [];
  const re = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\/:(\w+)/g, (_, k) => {
    keys.push(k);
    return '/([^/]+)';
  });
  return { regex: new RegExp(`^${re}/?$`), keys };
}

export function createRouter(routes) {
  const compiled = routes.map((r) => ({ ...r, ...compilePath(r.path) }));
  return {
    routes: compiled,
    match(method, pathname) {
      let pathMatched = false;
      for (const r of compiled) {
        const m = r.regex.exec(pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== method) continue;
        const params = {};
        r.keys.forEach((k, i) => {
          try {
            params[k] = decodeURIComponent(m[i + 1]);
          } catch {
            params[k] = m[i + 1];
          }
        });
        return { route: r, params };
      }
      return pathMatched ? { methodNotAllowed: true } : null;
    },
  };
}
