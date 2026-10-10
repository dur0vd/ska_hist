import sanitizeHtml from 'sanitize-html';
import { allowed, remove, safeUrl } from '../assets/content-policy.js';

// Правила совпадают с редактором; проверяются и при сборке, а не только в браузере.
export function sanitizePage(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: allowed,
    nonTextTags: remove,
    allowedAttributes: { a: ['href'], img: ['src','alt'], td: ['rowspan','colspan'], th: ['rowspan','colspan'], ol: ['start'] },
    allowedSchemes: ['http','https','mailto','tel'],
    allowProtocolRelative: false,
    transformTags: {
      '*': (tagName, attribs) => {
        if ('href' in attribs && !safeUrl(attribs.href, false)) delete attribs.href;
        if ('src' in attribs && !safeUrl(attribs.src, true)) delete attribs.src;
        for (const key of ['rowspan','colspan']) if (key in attribs && !/^(?:[1-9]|[12][0-9]|30)$/.test(attribs[key])) delete attribs[key];
        if ('start' in attribs && !/^\d{1,4}$/.test(attribs.start)) delete attribs.start;
        return { tagName, attribs };
      }
    },
    exclusiveFilter: frame => frame.tag === 'img' && !frame.attribs.src
  });
}
