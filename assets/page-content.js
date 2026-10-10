/* Общий формат редактора и опубликованных страниц. */
(function (root) {
  'use strict';
  var allowed = 'p div br h2 h3 strong b em i u s ul ol li blockquote table caption thead tbody tfoot tr th td a img figure figcaption hr'.split(' ');
  var remove = 'script style iframe object embed form input button textarea select svg math template link meta base'.split(' ');
  function safeUrl(value, image) {
    if (!value || /[\u0000-\u0020\\]/.test(value)) return false;
    if (image) return /^(img|files)\/[a-zA-Z0-9_./~-]+$/.test(value) && !value.includes('..');
    return /^(https?:\/\/|mailto:|tel:|#)/i.test(value) ||
      (/^[a-zA-Z0-9_./~#?-]+$/.test(value) && !value.startsWith('//') && !value.includes('..') && !value.includes(':'));
  }
  function sanitize(html, document) {
    var box = document.createElement('div');
    box.innerHTML = html;
    Array.from(box.querySelectorAll('*')).forEach(function (el) {
      var tag = el.tagName.toLowerCase();
      if (remove.includes(tag)) { el.remove(); return; }
      if (!allowed.includes(tag)) { el.replaceWith(...el.childNodes); return; }
      var attrs = {};
      if (tag === 'a' && safeUrl(el.getAttribute('href'), false)) attrs.href = el.getAttribute('href');
      if (tag === 'img' && safeUrl(el.getAttribute('src'), true)) {
        attrs.src = el.getAttribute('src'); attrs.alt = el.getAttribute('alt') || '';
      }
      if (tag === 'td' || tag === 'th') ['rowspan', 'colspan'].forEach(function (k) {
        var n = Number(el.getAttribute(k)); if (n >= 1 && n <= 30) attrs[k] = String(n);
      });
      if (tag === 'ol' && /^\d{1,4}$/.test(el.getAttribute('start') || '')) attrs.start = el.getAttribute('start');
      Array.from(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
      Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      if (tag === 'img' && !attrs.src) el.remove();
      if (tag === 'a' && !attrs.href) el.replaceWith(...el.childNodes);
    });
    return box.innerHTML;
  }
  var api = { sanitize: sanitize, safeUrl: safeUrl, allowed: allowed, remove: remove };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PageContent = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
export default globalThis.PageContent;
