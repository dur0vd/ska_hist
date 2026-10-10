// Однократный перенос существующих страниц в редактор. Повторный запуск не заменяет правки.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import { sanitizePage } from './page-content.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slugs = ['fgu-gruppa-107', 'fgu-zadaniya', 'fgu-rezultaty', 'fgu-itogi-semestra',
  'fgu-seminary-1', 'fgu-seminary-2', 'fgu-rejtingovaya-sistema', 'fgu-voprosy-k-ekzamenu',
  'fgu-raboty-studentov', 'kursovye-temy', 'kursovye-metodika', 'kursovye-raspredelenie', 'kursovye-indeks'];
fs.mkdirSync(path.join(root, 'data/editable'), { recursive: true });
for (const slug of slugs) {
  const target = path.join(root, 'data/editable', slug + '.json');
  if (fs.existsSync(target)) continue;
  const file = path.join(root, slug + '.html');
  let html = '';
  if (fs.existsSync(file)) {
    const $ = cheerio.load(fs.readFileSync(file, 'utf8'));
    const body = $('main > .content');
    body.find('.pager').remove();
    body.find('a.file').each((_, node) => {
      const a = $(node), href = a.attr('href');
      const label = a.find('.file-txt').text().replace(/\s+/g, ' ').trim();
      a.empty().text(label).attr('href', href);
    });
    body.find('.prose, .files').each((_, node) => $(node).replaceWith($(node).contents()));
    html = sanitizePage(body.html() || '');
  }
  fs.writeFileSync(target, JSON.stringify({ html }, null, 2) + '\n');
}
console.log('Страницы редактора подготовлены.');
