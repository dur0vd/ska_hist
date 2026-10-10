import * as cheerio from 'cheerio';
import content from '../assets/page-content.js';

// Правила совпадают с редактором; проверяются и при сборке, а не только в браузере.
export function sanitizePage(html) {
  const $ = cheerio.load(`<div id="page-content-root">${html}</div>`, null, false);
  const root = $('#page-content-root');
  root.find('*').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const node = $(el);
    if (content.remove.includes(tag)) { node.remove(); return; }
    if (!content.allowed.includes(tag)) { node.replaceWith(node.contents()); return; }
    const attrs = {};
    if (tag === 'a' && content.safeUrl(node.attr('href'), false)) attrs.href = node.attr('href');
    if (tag === 'img' && content.safeUrl(node.attr('src'), true)) {
      attrs.src = node.attr('src'); attrs.alt = node.attr('alt') || '';
    }
    if (tag === 'td' || tag === 'th') for (const k of ['rowspan', 'colspan']) {
      const n = Number(node.attr(k)); if (n >= 1 && n <= 30) attrs[k] = String(n);
    }
    if (tag === 'ol' && /^\d{1,4}$/.test(node.attr('start') || '')) attrs.start = node.attr('start');
    for (const k of Object.keys(el.attribs || {})) node.removeAttr(k);
    node.attr(attrs);
    if (tag === 'img' && !attrs.src) node.remove();
    if (tag === 'a' && !attrs.href) node.replaceWith(node.contents());
  });
  return root.html();
}
