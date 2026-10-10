import DOMPurify from './vendor/purify.es.mjs';
import { allowed, remove, safeUrl } from './content-policy.js';

DOMPurify.addHook('afterSanitizeAttributes', function (node) {
  if (node.hasAttribute('href') && !safeUrl(node.getAttribute('href'), false)) node.removeAttribute('href');
  if (node.hasAttribute('src') && !safeUrl(node.getAttribute('src'), true)) node.removeAttribute('src');
  ['rowspan', 'colspan'].forEach(function (key) {
    if (node.hasAttribute(key) && !/^(?:[1-9]|[12][0-9]|30)$/.test(node.getAttribute(key))) node.removeAttribute(key);
  });
  if (node.hasAttribute('start') && !/^\d{1,4}$/.test(node.getAttribute('start'))) node.removeAttribute('start');
});

function sanitize(html) {
  return DOMPurify.sanitize(String(html || ''), {
    ALLOWED_TAGS: allowed,
    ALLOWED_ATTR: ['href','src','alt','rowspan','colspan','start'],
    FORBID_TAGS: remove,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    SANITIZE_NAMED_PROPS: true
  });
}
// Текст извлекается в инертном документе после очистки. Не создаём активный img/onerror.
function text(html) {
  return new DOMParser().parseFromString(sanitize(html), 'text/html').body.textContent || '';
}
export default { sanitize, text, safeUrl };
