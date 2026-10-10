// Единые правила для редактора и сборки сайта.
export const allowed = 'p div br h2 h3 strong b em i u s ul ol li blockquote table caption thead tbody tfoot tr th td a img figure figcaption hr'.split(' ');
export const remove = 'script style iframe object embed form input button textarea select svg math template link meta base'.split(' ');
export function safeUrl(value, image) {
  if (!value || /[\u0000-\u0020\\]/.test(value)) return false;
  if (image) return /^(img|files)\/[a-zA-Z0-9_./~-]+$/.test(value) && !value.includes('..');
  return /^(https?:\/\/|mailto:|tel:|#)/i.test(value) ||
    (/^[a-zA-Z0-9_./~#?-]+$/.test(value) && !value.startsWith('//') && !value.includes('..') && !value.includes(':'));
}
export const attachmentExtensions = ['pdf','doc','docx','xls','xlsx','csv','txt','ppt','pptx','png','jpg','jpeg','webp','gif','zip'];
export function safeAttachmentName(name) {
  return attachmentExtensions.includes(String(name).split('.').pop().toLowerCase());
}
