// В Pages попадают только публичные страницы и материалы.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (name.endsWith('.html') || name === '.nojekyll') fs.copyFileSync(path.join(root, name), path.join(out, name));
}
for (const name of ['assets', 'files', 'img']) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
