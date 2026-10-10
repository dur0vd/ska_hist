import PageContent from './page-content.js';

(function () {
  'use strict';

  var OWNER = 'dur0vd', REPO = 'ska_hist', BRANCH = 'main';
  var API = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/';
  var KEY = 'ska_admin_key';
  var MAX_MB = 50;

  var $ = function (id) { return document.getElementById(id); };
  var token = '';
  try { token = localStorage.getItem(KEY) || ''; } catch (e) {}

  // ---------- вспомогательное ----------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function stripTags(html) {
    var d = document.createElement('div'); d.innerHTML = html; return d.textContent || '';
  }
  function status(kind, text) {
    var s = $('status');
    s.className = 'status ' + kind;
    s.textContent = text;
    s.hidden = false;
    if (kind === 'ok') s.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function busy(form, on) {
    var b = form && form.querySelector('button[type=submit]');
    if (b) b.disabled = on;
  }

  var TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' };
  function safeName(name) {
    var dot = name.lastIndexOf('.');
    var base = dot > 0 ? name.slice(0, dot) : name;
    var ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
    base = base.toLowerCase().split('').map(function (c) { return TR[c] !== undefined ? TR[c] : c; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
    return base + ext.replace(/[^a-z0-9.]/g, '');
  }

  function toBase64Utf8(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromBase64Utf8(b64) {
    var bin = atob(b64.replace(/\n/g, '')), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1]); };
      r.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      r.readAsDataURL(file);
    });
  }

  // ---------- GitHub API ----------
  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + path.split('/').map(encodeURIComponent).join('/') + (opts.method && opts.method !== 'GET' ? '' : '?ref=' + BRANCH), {
      method: opts.method || 'GET',
      cache: 'no-store',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401) throw new Error('Ключ не подошёл или истёк. Выйдите и введите ключ заново.');
      if (r.status === 403 || r.status === 404 && opts.method) throw new Error('Нет прав на изменение. Проверьте ключ (см. инструкцию).');
      if (r.status === 404) return null;
      if (r.status === 409 || r.status === 422) throw new Error('Файл только что изменился. Повторите действие.');
      if (!r.ok) throw new Error('Ошибка GitHub: ' + r.status);
      return r.status === 204 ? {} : r.json();
    });
  }
  function getFile(path) { return gh(path); }
  function putFile(path, b64, message, sha) {
    var body = { message: message, content: b64, branch: BRANCH };
    if (sha) body.sha = sha;
    return gh(path, { method: 'PUT', body: body });
  }
  function delFile(path, sha, message) {
    return gh(path, { method: 'DELETE', body: { message: message, sha: sha, branch: BRANCH } });
  }
  function readJson(path, def) {
    return getFile(path).then(function (f) {
      if (!f) return { data: def, sha: null };
      return { data: JSON.parse(fromBase64Utf8(f.content)), sha: f.sha };
    });
  }
  function writeJson(path, data, sha, message) {
    return putFile(path, toBase64Utf8(JSON.stringify(data, null, 2) + '\n'), message, sha);
  }

  // ---------- вход ----------
  function showApp(login) {
    $('login').hidden = true;
    $('app').hidden = false;
    $('who').textContent = 'Вы вошли' + (login ? ' (' + login + ')' : '');
    loadNews();
    loadLectures();
  }
  function checkToken() {
    return fetch('https://api.github.com/repos/' + OWNER + '/' + REPO, {
      cache: 'no-store',
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': 'Bearer ' + token }
    }).then(function (r) {
      if (r.status === 401) throw new Error('Ключ не подошёл. Проверьте, что скопировали его целиком.');
      if (!r.ok) throw new Error('Не удалось проверить ключ (' + r.status + ').');
      return r.json();
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) throw new Error('У этого ключа нет права менять сайт. Нужен ключ с доступом «Contents: Read and write».');
    });
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    token = $('token').value.trim();
    var form = e.target;
    busy(form, true);
    status('busy', 'Проверяю ключ…');
    checkToken().then(function () {
      try { localStorage.setItem(KEY, token); } catch (err) {}
      $('status').hidden = true;
      showApp();
    }).catch(function (err) {
      token = '';
      status('err', err.message);
    }).then(function () { busy(form, false); });
  });

  $('logout').addEventListener('click', function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    token = '';
    $('app').hidden = true;
    $('login').hidden = false;
    $('token').value = '';
    $('status').hidden = true;
  });

  // вкладки
  Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (b) {
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.tabs button'), function (x) {
        x.setAttribute('aria-selected', String(x === b));
      });
      Array.prototype.forEach.call(document.querySelectorAll('.tabpane'), function (pane) {
        pane.hidden = pane.id !== 'tab-' + b.dataset.tab;
      });
      if (b.dataset.tab === 'pages' && !pageLoaded) loadPage();
    });
  });

  // ---------- объявления ----------
  var today = new Date();
  $('n-date').value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  function ruDate(iso) { var p = iso.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function dateKey(d) { return d.split('.').reverse().join(''); }

  function loadNews() {
    var ul = $('news-list');
    ul.innerHTML = '<li class="empty">Загружаю…</li>';
    readJson('data/announcements.json', []).then(function (r) {
      var list = r.data.slice().sort(function (a, b) { return dateKey(b.date).localeCompare(dateKey(a.date)); });
      if (!list.length) { ul.innerHTML = '<li class="empty">Объявлений пока нет.</li>'; return; }
      ul.innerHTML = list.map(function (n) {
        return '<li><div class="grow"><time>' + esc(n.date) + '</time>' + esc(stripTags(n.html)) +
          '</div><button class="del" type="button" data-id="' + esc(n.id) + '">Удалить</button></li>';
      }).join('');
    }).catch(function (err) { ul.innerHTML = ''; status('err', err.message); });
  }

  $('news-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.del');
    if (!btn) return;
    if (!confirm('Удалить это объявление?')) return;
    btn.disabled = true;
    status('busy', 'Удаляю…');
    readJson('data/announcements.json', []).then(function (r) {
      var data = r.data.filter(function (n) { return n.id !== btn.dataset.id; });
      return writeJson('data/announcements.json', data, r.sha, 'Удалено объявление');
    }).then(function () {
      status('ok', 'Готово. Объявление исчезнет с сайта через 1–2 минуты.');
      loadNews();
    }).catch(function (err) { status('err', err.message); btn.disabled = false; });
  });

  $('news-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var text = $('n-text').value.replace(/\s+/g, ' ').trim();
    var file = $('n-file').files[0];
    if (file && file.size > MAX_MB * 1048576) { status('err', 'Файл слишком большой (больше ' + MAX_MB + ' МБ).'); return; }
    busy(form, true);
    status('busy', file ? 'Загружаю файл и публикую…' : 'Публикую…');

    var link = Promise.resolve('');
    if (file) {
      var name = safeName(file.name);
      var path = 'files/materials/' + name;
      link = fileToBase64(file).then(function (b64) {
        return getFile(path).then(function (ex) {
          return putFile(path, b64, 'Файл к объявлению: ' + name, ex && ex.sha);
        });
      }).then(function () {
        var label = $('n-label').value.trim() || file.name;
        return ' <a href="' + path + '" download>' + esc(label) + '</a>';
      });
    }

    link.then(function (linkHtml) {
      return readJson('data/announcements.json', []).then(function (r) {
        r.data.push({ id: 'n' + Date.now(), date: ruDate($('n-date').value), html: esc(text) + linkHtml });
        return writeJson('data/announcements.json', r.data, r.sha, 'Новое объявление');
      });
    }).then(function () {
      status('ok', 'Готово. Объявление появится на сайте через 1–2 минуты.');
      form.reset();
      $('n-date').value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      loadNews();
    }).catch(function (err) { status('err', err.message); })
      .then(function () { busy(form, false); });
  });

  // ---------- лекции ----------
  var GROUPS = { 'lekciya-': 'ФГУ', 'mehmat-lekciya-': 'Мехмат', 'speckurs-lekciya-': 'Спецкурс' };
  var lectures = [];   // {prefix, n, name, sha}
  var titles = {};

  function parseLec(name, sha) {
    var m = name.match(/^(speckurs-lekciya-|mehmat-lekciya-|lekciya-)(\d+)\.(pptx|ppt|pdf)$/);
    return m ? { prefix: m[1], n: +m[2], name: name, sha: sha } : null;
  }

  function loadLectures() {
    var box = $('lec-list');
    box.textContent = 'Загружаю…';
    Promise.all([gh('files'), readJson('data/lectures.json', {})]).then(function (res) {
      lectures = (res[0] || []).map(function (f) { return parseLec(f.name, f.sha); }).filter(Boolean);
      titles = res[1].data;
      renderLectures();
      suggestNumber();
    }).catch(function (err) { box.textContent = ''; status('err', err.message); });
  }

  function renderLectures() {
    var html = '';
    Object.keys(GROUPS).forEach(function (p) {
      var items = lectures.filter(function (l) { return l.prefix === p; }).sort(function (a, b) { return a.n - b.n; });
      if (!items.length) return;
      html += '<div class="lec-group"><h3>' + GROUPS[p] + '</h3><ul class="adm-list">' + items.map(function (l) {
        var t = titles[p + l.n];
        return '<li><div class="grow">Лекция ' + l.n + (t ? ' — ' + esc(t) : '') +
          '</div><button class="del" type="button" data-name="' + esc(l.name) + '" data-sha="' + esc(l.sha) + '">Удалить</button></li>';
      }).join('') + '</ul></div>';
    });
    $('lec-list').innerHTML = html || '<p class="hint">Лекций пока нет.</p>';
  }

  function suggestNumber() {
    var p = $('l-group').value;
    var nums = lectures.filter(function (l) { return l.prefix === p; }).map(function (l) { return l.n; });
    var next = nums.length ? Math.max.apply(null, nums) + 1 : 1;
    $('l-num').value = next;
    $('l-hint').textContent = nums.length ? 'Сейчас загружено лекций: ' + nums.length + ' (последняя — № ' + (next - 1) + '). Предложен следующий номер. Если указать уже существующий номер, файл будет заменён.' : 'Для этого курса лекций пока нет.';
  }
  $('l-group').addEventListener('change', suggestNumber);

  $('lec-list').addEventListener('click', function (e) {
    var btn = e.target.closest('.del');
    if (!btn) return;
    if (!confirm('Удалить файл «' + btn.dataset.name + '» с сайта?')) return;
    btn.disabled = true;
    status('busy', 'Удаляю…');
    delFile('files/' + btn.dataset.name, btn.dataset.sha, 'Удалена лекция ' + btn.dataset.name).then(function () {
      status('ok', 'Готово. Лекция исчезнет с сайта через 1–2 минуты.');
      loadLectures();
    }).catch(function (err) { status('err', err.message); btn.disabled = false; });
  });

  $('lec-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var form = e.target;
    var file = $('l-file').files[0];
    var prefix = $('l-group').value;
    var n = parseInt($('l-num').value, 10);
    if (!file || !n) return;
    var ext = (file.name.split('.').pop() || '').toLowerCase();
    if (['pptx', 'ppt', 'pdf'].indexOf(ext) < 0) { status('err', 'Нужен файл .pptx или .pdf.'); return; }
    if (file.size > MAX_MB * 1048576) { status('err', 'Файл слишком большой (больше ' + MAX_MB + ' МБ). Сожмите картинки в презентации.'); return; }

    var name = prefix + n + '.' + ext;
    var existing = lectures.filter(function (l) { return l.prefix === prefix && l.n === n; });
    if (existing.length && !confirm('Лекция ' + n + ' (' + GROUPS[prefix] + ') уже есть. Заменить её?')) return;

    busy(form, true);
    status('busy', 'Загружаю лекцию… (большие файлы могут грузиться минуту)');
    var title = $('l-title').value.trim();
    var path = 'files/' + name;

    fileToBase64(file).then(function (b64) {
      // если у старой версии другое расширение — убираем её, чтобы не было дублей
      var removeOld = existing.filter(function (l) { return l.name !== name; });
      return gh(path).then(function (ex) {
        return putFile(path, b64, 'Лекция ' + n + ' (' + GROUPS[prefix] + ')', ex && ex.sha);
      }).then(function () {
        return removeOld.reduce(function (p, l) {
          return p.then(function () { return delFile('files/' + l.name, l.sha, 'Замена лекции ' + n); });
        }, Promise.resolve());
      });
    }).then(function () {
      if (!title && !titles[prefix + n]) return null;
      return readJson('data/lectures.json', {}).then(function (r) {
        if (title) r.data[prefix + n] = title;
        return writeJson('data/lectures.json', r.data, r.sha, 'Название лекции ' + n);
      });
    }).then(function () {
      status('ok', 'Готово. Лекция появится на сайте через 1–2 минуты.');
      form.reset();
      loadLectures();
    }).catch(function (err) { status('err', err.message); })
      .then(function () { busy(form, false); });
  });

  // ---------- страницы ----------
  var pageLoaded = false, pageSlug = '', pageSha = null, pageDirty = false;
  var pageWorking = false, pageRange = null, selectedImage = null;
  var editor = $('p-editor');

  function markPageDirty() {
    pageDirty = true;
    $('p-state').textContent = 'Есть несохранённые изменения.';
    $('p-preview').hidden = true;
  }
  function pageBusy(on) {
    pageWorking = on;
    $('p-page').disabled = on;
    $('p-save').disabled = on || !pageLoaded;
    ['p-upload', 'p-reload', 'p-preview-button'].forEach(function (id) { $(id).disabled = on || !pageLoaded; });
    editor.contentEditable = String(!on && pageLoaded);
  }
  function pagePath() { return 'data/editable/' + pageSlug + '.json'; }
  function rememberSelection() {
    var sel = window.getSelection();
    if (sel.rangeCount && editor.contains(sel.anchorNode) && editor.contains(sel.focusNode)) pageRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreSelection() {
    editor.focus();
    var sel = window.getSelection();
    if (!pageRange || !editor.contains(pageRange.startContainer)) {
      pageRange = document.createRange(); pageRange.selectNodeContents(editor); pageRange.collapse(false);
    }
    sel.removeAllRanges(); sel.addRange(pageRange);
  }
  function insertPageHtml(html) {
    restoreSelection();
    document.execCommand('insertHTML', false, PageContent.sanitize(html, document));
    rememberSelection(); markPageDirty();
  }
  function loadPage() {
    pageSlug = $('p-page').value;
    pageLoaded = false; pageBusy(true);
    $('p-state').textContent = 'Загружаю страницу…';
    $('p-public').href = pageSlug + '.html';
    readJson(pagePath(), { html: '' }).then(function (r) {
      editor.innerHTML = PageContent.sanitize(r.data.html || '', document);
      pageSha = r.sha;
      pageDirty = false; pageLoaded = true; pageRange = null; selectedImage = null;
      $('p-preview').hidden = true;
      $('p-state').textContent = 'Можно редактировать текст и таблицы. Картинку можно заменить: нажмите на неё, удалите и добавьте новую.';
    }).catch(function (err) {
      $('p-state').textContent = 'Не удалось загрузить страницу. Откройте вкладку повторно.';
      status('err', err.message);
    }).then(function () { pageBusy(false); });
  }
  $('p-page').addEventListener('change', function () {
    if (pageDirty && !confirm('На странице есть несохранённые изменения. Перейти без сохранения?')) {
      $('p-page').value = pageSlug; return;
    }
    loadPage();
  });
  $('p-reload').addEventListener('click', function () {
    if (pageDirty && !confirm('Загрузить сохранённый текст и отменить несохранённые изменения?')) return;
    loadPage();
  });
  editor.addEventListener('input', markPageDirty);
  ['keyup', 'mouseup', 'focusout'].forEach(function (event) { editor.addEventListener(event, rememberSelection); });
  editor.addEventListener('click', function (e) {
    if (selectedImage) selectedImage.classList.remove('selected');
    selectedImage = e.target.tagName === 'IMG' ? e.target : null;
    if (selectedImage) selectedImage.classList.add('selected');
  });
  editor.addEventListener('paste', function (e) {
    e.preventDefault();
    var html = e.clipboardData.getData('text/html');
    if (!html) html = esc(e.clipboardData.getData('text/plain')).replace(/\r?\n/g, '<br>');
    rememberSelection(); insertPageHtml(html);
  });
  // Файлы добавляются через форму, чтобы картинки не оставались локальными data: URL.
  editor.addEventListener('drop', function (e) { e.preventDefault(); status('err', 'Для загрузки используйте «Прикрепить документ или картинку».'); });
  $('p-toolbar').addEventListener('mousedown', function (e) { if (e.target.closest('button')) e.preventDefault(); });
  $('p-toolbar').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || pageWorking || !pageLoaded) return;
    if (btn.dataset.command || btn.dataset.block) {
      restoreSelection();
      document.execCommand(btn.dataset.command || 'formatBlock', false, btn.dataset.block || null);
      rememberSelection(); markPageDirty();
    }
  });
  $('p-link').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    var url = prompt('Адрес ссылки (например, https://example.ru или lekcii.html):');
    if (!url) return;
    url = url.trim();
    if (!PageContent.safeUrl(url, false)) { status('err', 'Укажите обычный адрес сайта или файла.'); return; }
    restoreSelection();
    var label = window.getSelection().toString() || prompt('Текст ссылки:', url);
    if (label) insertPageHtml('<a href="' + esc(url) + '">' + esc(label) + '</a>');
  });
  $('p-table').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    var rows = Number(prompt('Количество строк (включая заголовок, от 2 до 30):', '5'));
    if (!rows) return;
    var cols = Number(prompt('Количество столбцов (от 1 до 10):', '3'));
    if (!Number.isInteger(rows) || rows < 2 || rows > 30 || !Number.isInteger(cols) || cols < 1 || cols > 10) {
      status('err', 'Укажите от 2 до 30 строк и от 1 до 10 столбцов.'); return;
    }
    var html = '<table><tbody>';
    for (var r = 0; r < rows; r++) {
      html += '<tr>';
      for (var c = 0; c < cols; c++) html += r === 0 ? '<th>Заголовок ' + (c + 1) + '</th>' : '<td><br></td>';
      html += '</tr>';
    }
    insertPageHtml(html + '</tbody></table><p><br></p>');
  });
  function selectedRow() {
    restoreSelection();
    var node = window.getSelection().anchorNode;
    var el = node && (node.nodeType === 1 ? node : node.parentElement);
    var row = el && el.closest('tr');
    if (!row || !editor.contains(row)) { status('err', 'Сначала нажмите на ячейку нужной таблицы.'); return null; }
    return row;
  }
  $('p-row').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    var row = selectedRow(); if (!row) return;
    var newRow = document.createElement('tr');
    Array.from(row.cells).forEach(function (cell) {
      var td = document.createElement('td'); td.innerHTML = '<br>';
      if (cell.colSpan > 1) td.colSpan = cell.colSpan;
      newRow.appendChild(td);
    });
    row.after(newRow); markPageDirty();
  });
  $('p-delete-row').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    var row = selectedRow(); if (!row) return;
    var table = row.closest('table'); row.remove();
    if (!table.querySelector('tr')) table.remove();
    pageRange = null; markPageDirty();
  });
  $('p-remove-image').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    if (!selectedImage || !editor.contains(selectedImage)) { status('err', 'Сначала нажмите на картинку в редакторе.'); return; }
    var parent = selectedImage.parentElement;
    selectedImage.remove();
    if (parent.tagName === 'A' && !parent.textContent.trim()) parent.remove();
    selectedImage = null; markPageDirty();
  });
  $('p-preview-button').addEventListener('click', function () {
    $('p-preview-content').innerHTML = PageContent.sanitize(editor.innerHTML, document);
    $('p-preview').hidden = false;
    $('p-preview').scrollIntoView({ block: 'start', behavior: 'smooth' });
  });
  $('p-upload').addEventListener('click', function () {
    if (pageWorking || !pageLoaded) return;
    var file = $('p-file').files[0];
    if (!file) { status('err', 'Выберите документ или картинку.'); return; }
    var ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf','doc','docx','xls','xlsx','csv','txt','ppt','pptx','png','jpg','jpeg','webp','gif','zip'].includes(ext)) {
      status('err', 'Нужен документ, таблица, презентация или картинка PNG/JPG/WebP/GIF.'); return;
    }
    if (file.size > MAX_MB * 1048576) { status('err', 'Файл больше 50 МБ.'); return; }
    var path = 'files/pages/' + pageSlug + '/' + Date.now() + '-' + safeName(file.name);
    var label = $('p-file-label').value.trim() || file.name;
    pageBusy(true); status('busy', 'Загружаю файл…');
    fileToBase64(file).then(function (b64) {
      return putFile(path, b64, 'Материал: ' + label);
    }).then(function () {
      var html = ['png','jpg','jpeg','webp','gif'].includes(ext) ?
        '<p><a href="' + path + '"><img src="' + path + '" alt="' + esc(label) + '"></a></p>' :
        '<p><a href="' + path + '">' + esc(label) + '</a></p>';
      // Файл уже в репозитории; ссылка сохраняется только с содержанием страницы.
      pageBusy(false); insertPageHtml(html);
      $('p-file').value = ''; $('p-file-label').value = '';
      status('ok', 'Файл добавлен в редактор. Теперь нажмите «Сохранить страницу».');
    }).catch(function (err) { status('err', err.message); })
      .then(function () { pageBusy(false); });
  });
  $('page-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (pageWorking || !pageLoaded) return;
    var html = PageContent.sanitize(editor.innerHTML, document);
    if (!stripTags(html).trim() && !/<img\b/.test(html) && !confirm('Страница будет пустой. Сохранить?')) return;
    pageBusy(true); status('busy', 'Сохраняю страницу…');
    // SHA относится к загруженной версии: чужие правки не перезаписываем.
    writeJson(pagePath(), { html: html }, pageSha, 'Обновлена страница: ' + $('p-page').selectedOptions[0].textContent).then(function (r) {
      pageSha = r.content.sha; editor.innerHTML = html;
      pageDirty = false; pageRange = null;
      $('p-state').textContent = 'Изменения сохранены.';
      status('ok', 'Сохранено. Публикация обычно занимает 1–5 минут. Затем обновите страницу сайта.');
    }).catch(function (err) {
      status('err', err.message + ' Ваш текст остался в редакторе. При конфликте скопируйте правки и загрузите страницу заново.');
    }).then(function () { pageBusy(false); });
  });
  window.addEventListener('beforeunload', function (e) {
    if (pageDirty || pageWorking) { e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- старт ----------
  if (token) {
    status('busy', 'Проверяю ключ…');
    checkToken().then(function () { $('status').hidden = true; showApp(); })
      .catch(function (err) { token = ''; try { localStorage.removeItem(KEY); } catch (e) {} status('err', err.message); });
  }
})();
