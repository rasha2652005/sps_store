// A tiny stand-in for Turso's HTTP API (Hrana v2 pipeline), backed by an in-memory SQLite database.
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';

const fromValue = (v) => {
  switch (v?.type) {
    case 'integer':
      return BigInt(v.value);
    case 'float':
      return Number(v.value);
    case 'text':
      return v.value;
    case 'blob':
      return Buffer.from(v.base64, 'base64');
    default:
      return null;
  }
};
const toValue = (v) => {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'bigint') return { type: 'integer', value: v.toString() };
  if (typeof v === 'number') return Number.isInteger(v) ? { type: 'integer', value: String(v) } : { type: 'float', value: v };
  if (typeof v === 'string') return { type: 'text', value: v };
  return { type: 'blob', base64: Buffer.from(v).toString('base64') };
};

export function startMockTurso({ token = 'secret' } = {}) {
  const db = new DatabaseSync(':memory:');
  const state = { requests: 0, down: false };
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      state.requests++;
      if (state.down) {
        res.writeHead(503).end('unavailable');
        return;
      }
      if (req.url !== '/v2/pipeline' || req.method !== 'POST') return res.writeHead(404).end('not found');
      if (req.headers.authorization !== `Bearer ${token}`) return res.writeHead(401).end('Unauthorized');
      const { requests } = JSON.parse(body);
      const results = requests.map((r) => {
        if (r.type === 'close') return { type: 'ok', response: { type: 'close' } };
        try {
          const st = db.prepare(r.stmt.sql);
          st.setReadBigInts(true);
          const args = (r.stmt.args || []).map(fromValue);
          const cols = st.columns().map((c) => ({ name: c.name, decltype: c.type }));
          let rows = [];
          let affected = 0;
          if (cols.length) rows = st.all(...args).map((row) => cols.map((c) => toValue(row[c.name])));
          else affected = Number(st.run(...args).changes);
          return { type: 'ok', response: { type: 'execute', result: { cols, rows, affected_row_count: affected, last_insert_rowid: null } } };
        } catch (e) {
          return { type: 'error', error: { message: e.message, code: 'SQLITE_ERROR' } };
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ baton: null, base_url: null, results }));
    });
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      resolve({ url: `http://127.0.0.1:${server.address().port}`, token, db, state, close: () => new Promise((r) => server.close(r)) });
    }),
  );
}
