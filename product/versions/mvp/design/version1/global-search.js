// Global search: a rail button + ⌘K palette shared by every page that loads rail-order.js.
(function () {
  if (window.__opSearch) return; window.__opSearch = true;
  var PAGES = [
    ['Inbox', 'Plan · what needs you', './Tasks.dc.html?section=inbox'],
    ['Sessions', 'Terminal sessions', './SessionsConsole.dc.html'],
    ['Employees', 'Bots and their chats', './Bots.dc.html'],
    ['Pull requests', 'Review and merge', './PullRequests.dc.html'],
    ['Automations', 'Scheduled and triggered runs', './Routines.dc.html'],
    ['Plan', 'Tasks, milestones and calendar', './Tasks.dc.html'],
    ['Settings', 'Hosts, repositories and account', './Settings.dc.html'],
  ];
  var DATA = [
    ['Needs you', 'Merge #121 Port to peersyst', 'Release Bot · xrp-mobile', './Tasks.dc.html?section=inbox'],
    ['Needs you', 'Answer 3 questions on the gateway', 'Session Bot', './Tasks.dc.html?section=inbox'],
    ['Needs you', 'Validator upgrade moved to Oct 28', 'Gmail · ops@ripple.com', './Tasks.dc.html?section=inbox'],
    ['Sessions', 'PR #121 porting to peersyst', 'Claude Code · optimus · running', './SessionsConsole.dc.html'],
    ['Sessions', 'Sign-in screen rebuild', 'Claude Code · xrp-mobile · waiting', './SessionsConsole.dc.html'],
    ['Sessions', 'Gateway architecture research', 'Codex · oppenheimer · running', './SessionsConsole.dc.html'],
    ['Sessions', 'Node and Nest.js CVE dependencies', 'Claude Code · xrp-mobile · failed', './SessionsConsole.dc.html'],
    ['Bots', 'Oppenheimer', 'General bot', './Bots.dc.html'],
    ['Bots', 'Release Bot', 'Ships changes and watches runs', './Bots.dc.html'],
    ['Bots', 'Session Bot', 'Restarts and unblocks sessions', './Bots.dc.html'],
    ['Bots', 'Planning Bot', 'Drafts and triages tasks', './Bots.dc.html'],
    ['Pull requests', '#121 Port to peersyst', 'xrp-mobile · ready to merge', './PullRequests.dc.html'],
    ['Pull requests', '#118 Bump Next.js for CVE', 'cosmos-explorer · checks running', './PullRequests.dc.html'],
    ['Automations', 'Nightly e2e', 'Every day 02:00', './Routines.dc.html'],
    ['Automations', 'Dependency audit', 'Every night · failed twice', './Routines.dc.html'],
    ['Plan', 'Milestone 4 · Mobile sign-in', '3 tasks open', './Tasks.dc.html'],
  ];
  var SVG = function (d, s) { return '<svg width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var ICON = '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>';
  var mac = /Mac|iPhone|iPad/.test(navigator.platform);
  var ov = null, input, list, sel = 0, rows = [];

  function host() { var r = document.querySelector('.op-rail'); return (r && r.parentElement) || document.body; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function build() {
    ov = document.createElement('div');
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Search');
    ov.style.cssText = 'position:fixed;inset:0;z-index:1000;display:none;align-items:flex-start;justify-content:center;padding-top:14vh;background:var(--overlay,rgba(0,0,0,.5));backdrop-filter:blur(3px);font-family:var(--font-sans);color:var(--fg)';
    ov.innerHTML = '<div data-box style="width:min(600px,calc(100vw - 32px));max-height:60vh;display:flex;flex-direction:column;border-radius:18px;background:var(--card);border:1px solid var(--border-subtle);box-shadow:var(--shadow-modal);overflow:hidden">' +
      '<div style="display:flex;align-items:center;gap:10px;height:52px;padding:0 16px;border-bottom:1px solid var(--border-subtle);color:var(--fg-subtle)">' + SVG(ICON, 16) +
      '<input data-q type="text" placeholder="Search pages, sessions, bots, pull requests" aria-label="Search" style="flex:1;min-width:0;border:0;outline:0;background:none;font:inherit;font-size:15px;color:var(--fg)">' +
      '<kbd style="font-family:var(--font-mono);font-size:11px;padding:2px 6px;border-radius:6px;border:1px solid var(--border-subtle);color:var(--fg-subtle)">esc</kbd></div>' +
      '<div data-list role="listbox" style="flex:1;min-height:0;overflow-y:auto;padding:6px"></div></div>';
    host().appendChild(ov);
    input = ov.querySelector('[data-q]'); list = ov.querySelector('[data-list]');
    ov.addEventListener('mousedown', function (e) { if (!ov.querySelector('[data-box]').contains(e.target)) close(); });
    input.addEventListener('input', function () { sel = 0; render(); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(rows.length - 1, sel + 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); paint(); }
      else if (e.key === 'Enter') { e.preventDefault(); if (rows[sel]) go(rows[sel].href); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
  }
  function render() {
    var q = input.value.trim().toLowerCase(), m = function (s) { return !q || s.toLowerCase().indexOf(q) > -1; };
    var groups = [['Go to', PAGES.filter(function (p) { return m(p[0] + ' ' + p[1]); }).map(function (p) { return { t: p[0], s: p[1], href: p[2] }; })]];
    if (q) {
      var by = {};
      DATA.forEach(function (d) { if (m(d[1] + ' ' + d[2])) (by[d[0]] = by[d[0]] || []).push({ t: d[1], s: d[2], href: d[3] }); });
      Object.keys(by).forEach(function (k) { groups.push([k, by[k]]); });
    } else {
      groups.push(['Needs you', DATA.filter(function (d) { return d[0] === 'Needs you'; }).map(function (d) { return { t: d[1], s: d[2], href: d[3] }; })]);
    }
    rows = []; var html = '';
    groups.forEach(function (g) {
      if (!g[1].length) return;
      html += '<div style="padding:8px 10px 4px;font-size:11px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;color:var(--fg-subtle)">' + esc(g[0]) + '</div>';
      g[1].forEach(function (r) { var i = rows.length; rows.push(r);
        html += '<a data-i="' + i + '" href="' + r.href + '" role="option" style="display:flex;align-items:center;gap:12px;min-height:40px;padding:6px 10px;border-radius:10px;color:var(--fg);text-decoration:none">' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px">' + esc(r.t) + '</span>' +
          '<span style="flex:none;max-width:50%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--fg-subtle)">' + esc(r.s) + '</span></a>'; });
    });
    list.innerHTML = html || '<p style="margin:0;padding:24px 10px;font-size:13.5px;color:var(--fg-muted)">Nothing matches “' + esc(input.value) + '”.</p>';
    Array.prototype.forEach.call(list.querySelectorAll('[data-i]'), function (a) {
      a.addEventListener('mousemove', function () { var i = +a.getAttribute('data-i'); if (i !== sel) { sel = i; paint(); } });
    });
    paint();
  }
  function paint() {
    Array.prototype.forEach.call(list.querySelectorAll('[data-i]'), function (a) {
      var on = +a.getAttribute('data-i') === sel; a.style.background = on ? 'var(--hover-surface)' : 'transparent'; a.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) { var t = a.offsetTop, b = t + a.offsetHeight; if (t < list.scrollTop) list.scrollTop = t - 6; else if (b > list.scrollTop + list.clientHeight) list.scrollTop = b - list.clientHeight + 6; }
    });
  }
  function go(href) { close(); window.location.href = href; }
  function open() {
    if (!ov || !ov.isConnected) build();
    ov.style.display = 'flex'; input.value = ''; sel = 0; render();
    setTimeout(function () { input.focus(); }, 0);
  }
  function close() { if (ov) ov.style.display = 'none'; }
  window.opOpenSearch = open;

  document.addEventListener('keydown', function (e) {
    if ((mac ? e.metaKey : e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); if (ov && ov.style.display === 'flex') close(); else open(); }
  });

  function wire() {
    var rails = document.querySelectorAll('.op-rail');
    for (var i = 0; i < rails.length; i++) {
      var r = rails[i]; if (r.querySelector('[data-op-search]')) continue;
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('data-op-search', ''); b.setAttribute('aria-label', 'Search');
      b.style.cssText = 'order:0;flex:none;width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 4px;border:0;border-radius:10px;background:none;color:var(--fg-muted);cursor:pointer;position:relative';
      b.innerHTML = SVG(ICON, 18);
      b.title = 'Search  ' + (mac ? '⌘K' : 'Ctrl K');
      b.addEventListener('mouseenter', function () { this.style.background = 'var(--hover-surface)'; this.style.color = 'var(--fg)'; });
      b.addEventListener('mouseleave', function () { this.style.background = 'none'; this.style.color = 'var(--fg-muted)'; });
      b.addEventListener('click', function (e) { e.stopPropagation(); open(); });
      var mark = r.querySelector('.op-rail__mark');
      if (mark && mark.nextSibling) r.insertBefore(b, mark.nextSibling); else r.appendChild(b);
    }
  }
  new MutationObserver(function () { wire(); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') wire(); else document.addEventListener('DOMContentLoaded', wire);
})();
