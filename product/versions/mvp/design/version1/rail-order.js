// Drag to reorder the left rail (pointer-based, animated). Order is per user and shared by every page.
(function () {
  var KEY = 'op-rail-order';
  var EASE = 'cubic-bezier(.4,0,.2,1)';
  var keyOf = function (el) { return el.getAttribute('aria-label') || ''; };
  var items = function (rail) { return Array.prototype.filter.call(rail.children, function (el) { return el.classList.contains('op-rail__btn'); }); };
  var load = function () { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } };
  var save = function (order) { try { localStorage.setItem(KEY, JSON.stringify(order)); } catch (e) {} };
  var drag = null;

  function apply(rail) {
    if (drag) return;
    var saved = load(), list = items(rail);
    list.slice().sort(function (a, b) {
      var ia = saved.indexOf(keyOf(a)), ib = saved.indexOf(keyOf(b));
      return (ia < 0 ? 999 + list.indexOf(a) : ia) - (ib < 0 ? 999 + list.indexOf(b) : ib);
    }).forEach(function (el, i) { var o = String(i + 1); if (el.style.order !== o) el.style.order = o; });
    var mark = rail.querySelector('.op-rail__mark'); if (mark && mark.style.order !== '0') mark.style.order = '0';
  }
  function current(rail) { return items(rail).sort(function (a, b) { return (+a.style.order || 0) - (+b.style.order || 0); }); }

  function onDown(e) {
    if (e.button !== 0) return;
    var el = e.currentTarget, rail = el.parentElement;
    var list = current(rail), from = list.indexOf(el);
    var pitch = list.length > 1 ? list[1].getBoundingClientRect().top - list[0].getBoundingClientRect().top : el.offsetHeight + 6;
    drag = { el: el, rail: rail, list: list, from: from, to: from, y0: e.clientY, pitch: pitch, active: false, id: e.pointerId };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dy = e.clientY - drag.y0;
    if (!drag.active) {
      if (Math.abs(dy) < 5) return;
      drag.active = true;
      var el = drag.el;
      el.style.transition = 'box-shadow 140ms ' + EASE + ', background 140ms ' + EASE;
      el.style.zIndex = '5'; el.style.cursor = 'grabbing';
      el.style.background = 'var(--card)'; el.style.boxShadow = 'var(--shadow-popover)';
      document.body.style.cursor = 'grabbing'; document.body.style.userSelect = 'none';
      drag.list.forEach(function (x) { if (x !== el) x.style.transition = 'transform 180ms ' + EASE; });
    }
    var n = drag.list.length;
    var minDy = -drag.from * drag.pitch, maxDy = (n - 1 - drag.from) * drag.pitch;
    var cdy = Math.max(minDy - 8, Math.min(maxDy + 8, dy));
    drag.el.style.transform = 'translateY(' + cdy + 'px) scale(1.06)';
    var to = Math.max(0, Math.min(n - 1, Math.round(drag.from + cdy / drag.pitch)));
    drag.to = to;
    drag.list.forEach(function (x, i) {
      if (x === drag.el) return;
      var shift = 0;
      if (to > drag.from && i > drag.from && i <= to) shift = -drag.pitch;
      if (to < drag.from && i < drag.from && i >= to) shift = drag.pitch;
      x.style.transform = shift ? 'translateY(' + shift + 'px)' : '';
    });
  }
  function onUp(e) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    var d = drag; if (!d) return;
    if (!d.active) { drag = null; return; }
    var el = d.el;
    // Settle the dragged item into its slot, then commit the order with no visible jump.
    el.style.transition = 'transform 160ms ' + EASE + ', box-shadow 160ms ' + EASE;
    el.style.transform = 'translateY(' + ((d.to - d.from) * d.pitch) + 'px)';
    el.style.boxShadow = '';
    var swallow = function (ev) { ev.stopPropagation(); ev.preventDefault(); };
    el.addEventListener('click', swallow, true);
    setTimeout(function () {
      var order = d.list.slice(); order.splice(d.from, 1); order.splice(d.to, 0, el);
      order.forEach(function (x, i) { x.style.transition = 'none'; x.style.transform = ''; x.style.order = String(i + 1); });
      el.style.zIndex = ''; el.style.cursor = ''; el.style.background = '';
      document.body.style.cursor = ''; document.body.style.userSelect = '';
      void el.offsetHeight;
      order.forEach(function (x) { x.style.transition = ''; });
      save(order.map(keyOf));
      drag = null;
      setTimeout(function () { el.removeEventListener('click', swallow, true); }, 0);
    }, 170);
  }

  function wireRail(rail) {
    items(rail).forEach(function (el) {
      if (el.getAttribute('draggable') !== 'false') el.setAttribute('draggable', 'false');
      if (el.__opRailBtn) return; el.__opRailBtn = true;
      el.style.touchAction = 'none';
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
    });
    apply(rail);
  }
  var queued = false;
  function scan() { queued = false; var r = document.querySelectorAll('.op-rail'); for (var i = 0; i < r.length; i++) wireRail(r[i]); }
  new MutationObserver(function () { if (!queued) { queued = true; requestAnimationFrame(scan); } })
    .observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') scan(); else document.addEventListener('DOMContentLoaded', scan);
  setInterval(scan, 1500);
})();
