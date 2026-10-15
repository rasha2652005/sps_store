// Development mode: the API server on :3001 (restarts when backend files change) + Vite with hot reload on :5173.
// Open http://localhost:5173 while you work. For production use `npm run build` then `npm start`.
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const node = process.execPath;
let api = null;

function startApi() {
  api = spawn(node, ['--disable-warning=ExperimentalWarning', '--env-file-if-exists=.env', 'server/index.js'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, PORT: '3001' },
  });
}
let timer = null;
const restartApi = () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    console.log('\n↻ backend changed, restarting the API…');
    api?.kill();
    startApi();
  }, 250);
};

startApi();
for (const dir of ['core', 'server']) watch(join(root, dir), { recursive: true }, restartApi);

const vite = spawn(node, [join(root, 'node_modules/vite/bin/vite.js')], { cwd: root, stdio: 'inherit' });

const stop = () => {
  api?.kill();
  vite.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
