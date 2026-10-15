// Creates an admin account or resets its password from the command line:
//   npm run create-admin -- you@example.com "New password" "Your name"
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { migrate } from '../core/schema.js';
import { AUTH, hashPassword, passwordProblem } from '../core/auth.js';
import { isEmail, isoNow } from '../core/util.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [email, password, name = 'Owner'] = process.argv.slice(2);
if (!isEmail(email) || passwordProblem(password)) {
  console.log('Usage: npm run create-admin -- you@example.com "password (8+ characters)" "Your name"');
  process.exit(1);
}
const db = openDb(join(resolve(process.env.DATA_DIR || join(root, 'data')), 'store.db'));
migrate(db);
const hash = await hashPassword(password, AUTH.iterations);
const existing = db.get('SELECT id FROM admins WHERE email = ?', email.toLowerCase());
if (existing) {
  db.run('UPDATE admins SET password_hash = ? WHERE id = ?', hash, existing.id);
  db.run("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", existing.id);
  console.log(`Password updated for ${email}`);
} else {
  db.run("INSERT INTO admins (name, email, password_hash, role, created_at) VALUES (?, ?, ?, 'owner', ?)", name, email.toLowerCase(), hash, isoNow());
  console.log(`Owner account created for ${email}`);
}
db.close();
