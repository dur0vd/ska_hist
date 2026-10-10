// В Pages попадают только публичные страницы и материалы.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { safeAttachmentName } from '../assets/content-policy.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '_site');
// Не публикуем активные вложения и не оставляем файлы старой сборки.
for (const dir of ['files', 'img']) {
  for (const entry of fs.readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && !safeAttachmentName(entry.name)) throw new Error('Небезопасный тип вложения: ' + entry.name);
  }
}
if (fs.existsSync(out)) {
  // Удаляем только проверенную папку сборки внутри репозитория, не рабочие материалы.
  if (path.resolve(out) !== path.resolve(root, '_site')) throw new Error('Неверная папка сборки');
  fs.rmSync(out, { recursive: true });
}
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(root)) {
  if (name.endsWith('.html') || name === '.nojekyll') fs.copyFileSync(path.join(root, name), path.join(out, name));
}
for (const name of ['assets', 'files', 'img']) fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
