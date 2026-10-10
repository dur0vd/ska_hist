import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sanitizePage } from '../tools/page-content.mjs';
import { safeAttachmentName } from '../assets/content-policy.js';
import { createServer } from '../tools/serve.mjs';

test('HTML from pages and announcements cannot retain executable markup', () => {
  for (const html of [
    '<img src="img/photo.jpg" onerror="alert(1)">',
    '<script>alert(1)</script><p>Сохраняемый текст</p>',
    '<a href="java&#x73;cript:alert(1)">Ссылка</a>',
    '<a href="data:text/html,test">Ссылка</a>',
    '<svg onload="alert(1)"></svg><iframe srcdoc="test"></iframe>',
    '<form name="login"><input name="token"></form>',
    '<table><tr><td onclick="alert(1)" colspan="2">Данные</td></tr></table>',
    '<img src="//external.invalid/test"><base href="https://external.invalid">',
    '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=img/a.png onerror=alert(1)>">'
  ]) {
    const clean = sanitizePage(html);
    assert.doesNotMatch(clean, /<script|<iframe|<svg|<math|<form|<input|<base|\bon\w+\s*=|javascript:|data:text/i);
  }
  const safe = sanitizePage('<h2>Задания</h2><table><tr><td colspan="2">История</td></tr></table><a href="files/tasks.pdf">PDF</a><img src="img/photo.jpg" alt="Таблица">');
  assert.match(safe, /<table>/); assert.match(safe, /colspan="2"/); assert.match(safe, /files\/tasks.pdf/);
});

test('Only documents and raster images can be attachments', () => {
  for (const ext of ['html','htm','svg','js','mjs','exe','bat','cmd','ps1','php']) assert.equal(safeAttachmentName('tasks.' + ext), false, ext);
  for (const ext of ['pdf','docx','xlsx','pptx','png','jpg','zip']) assert.equal(safeAttachmentName('Задания.' + ext), true, ext);
});

test('Local preview cannot disclose Git, credentials or files outside the site', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ska-preview-test-'));
  fs.mkdirSync(path.join(dir, '.git'));
  fs.mkdirSync(path.join(dir, 'files'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>test</h1>');
  fs.writeFileSync(path.join(dir, '.git/config'), 'synthetic private marker');
  fs.writeFileSync(path.join(dir, '.env'), 'synthetic private marker');
  fs.writeFileSync(path.join(dir, 'letter.docx'), 'synthetic private marker');
  fs.writeFileSync(path.join(dir, 'files/unsafe.html'), '<h1>unsafe</h1>');
  const server = createServer(dir);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    assert.equal((await fetch(base + '/')).status, 200);
    for (const p of ['/.git/config','/.env','/letter.docx','/files/unsafe.html','/%2e%2e%5cprivate.txt']) {
      assert.equal((await fetch(base + p)).status,404,p);
    }
    assert.equal((await fetch(base + '/%')).status,400);
    assert.equal((await fetch(base + '/')).status,200,'malformed URL must not crash preview');
    assert.equal((await fetch(base + '/', {method:'POST'})).status,405);
  } finally {
    await new Promise(r => server.close(r));
    // Only the freshly created temporary fixture is removed.
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dir, {recursive:true});
  }
});
