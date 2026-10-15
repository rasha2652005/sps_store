// Stores uploaded product photos on disk (DATA_DIR/uploads), served at /uploads/...
// With a backup service configured (see remote.js), every photo is also saved there and restored on demand.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const MAGIC = {
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  webp: (b) => b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  avif: (b) => b.toString('ascii', 4, 8) === 'ftyp',
};
const EXT = { jpeg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', avif: 'avif' };

export function createStorage(uploadsDir, { remote = null } = {}) {
  mkdirSync(uploadsDir, { recursive: true });
  const write = (rel, buf) => {
    const file = join(uploadsDir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, buf);
    return file;
  };
  return {
    dir: uploadsDir,
    /**
     * Saves a base64 image. `as` (optional) is the URL of the main photo without extension plus a suffix,
     * used to store its small version next to it (photo.webp -> photo.t.webp).
     */
    async saveImage(dataUrl, type, as = null) {
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const buf = Buffer.from(base64, 'base64');
      const check = MAGIC[type];
      if (!check || !check(buf)) {
        const { bad } = await import('../core/errors.js');
        throw bad('image_invalid', 'This file is not a valid image');
      }
      let rel;
      if (as) {
        if (!/^\/uploads\/[\w/-]+\.t$/.test(as)) throw new Error('bad thumbnail name');
        rel = `${as.slice('/uploads/'.length)}.${EXT[type]}`;
      } else {
        const now = new Date();
        const sub = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        rel = `${sub}/${randomBytes(9).toString('hex')}.${EXT[type]}`;
      }
      const file = write(rel, buf);
      if (remote) {
        try {
          await remote.putFile(`/uploads/${rel}`, `image/${type}`, buf);
        } catch (e) {
          rmSync(file, { force: true });
          console.error(`[backup] photo not saved: ${e.message}`);
          const { HttpError } = await import('../core/errors.js');
          throw new HttpError(503, 'upload_failed', 'The photo could not be saved, please try again');
        }
      }
      return `/uploads/${rel}`;
    },
    saveSeedSvg(name, svg) {
      const rel = `seed/${name}`;
      write(rel, svg);
      remote?.queueFile(`/uploads/${rel}`, 'image/svg+xml', Buffer.from(svg));
      return `/uploads/${rel}`;
    },
  };
}
