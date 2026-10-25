// Sidebar toggle on every page (after the console's AppShell + SidebarToggle):
// each pane opens with a bar led by a quiet panel glyph that folds the sidebar away and back. ⌘B / Ctrl+B does the same.
(function () {
  if (window.__opSbToggle) return; window.__opSbToggle = true;
  var KEY = 'op-sidebar-collapsed', EASE = 'cubic-bezier(.4,0,.2,1)';
  var collapsed = false; try { collapsed = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var GLYPH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>';
  var mac = /Mac|iPhone|iPad/.test(navigator.platform);

  function sidebars() { return Array.prototype.filter.call(document.querySelectorAll('.op-sidebar'), function (el) { return el.tagName === 'NAV' || el.tagName === 'ASIDE'; }); }
  function apply(sb, animate) {
    if (!sb.__opW) { sb.__opW = sb.style.width || (sb.offsetWidth ? sb.offsetWidth + 'px' : '264px'); sb.__opMin = sb.style.minWidth || sb.__opW; }
    sb.style.transition = animate ? 'width 220ms ' + EASE + ', min-width 220ms ' + EASE + ', opacity 220ms ' + EASE : 'none';
    sb.style.overflow = 'hidden';
    if (collapsed) { sb.style.width = '0px'; sb.style.minWidth = '0px'; sb.style.opacity = '0'; sb.style.borderRightWidth = '0px'; sb.setAttribute('aria-hidden', 'true'); }
    else { sb.style.width = sb.__opW; sb.style.minWidth = sb.__opMin; sb.style.opacity = '1'; sb.style.borderRightWidth = ''; sb.removeAttribute('aria-hidden'); }
  }
  function sync(animate) {
    sidebars().forEach(function (sb) { apply(sb, animate); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-op-sbtoggle]'), function (b) {
      b.setAttribute('aria-pressed', collapsed ? 'false' : 'true');
      b.setAttribute('aria-label', collapsed ? 'Show sidebar' : 'Hide sidebar');
      b.title = (collapsed ? 'Show sidebar' : 'Hide sidebar') + '  ' + (mac ? '⌘B' : 'Ctrl B');
    });
  }
  function toggle() { collapsed = !collapsed; try { localStorage.setItem(KEY, collapsed ? '1' : '0'); } catch (e) {} sync(true); }
  window.opToggleSidebar = toggle;

  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('data-op-sbtoggle', '');
    b.style.cssText = 'flex:none;width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;padding:0;border:0;border-radius:980px;background:none;color:var(--fg-muted);cursor:pointer;transition:background 80ms ' + EASE + ',color 80ms ' + EASE;
    b.innerHTML = GLYPH;
    b.addEventListener('mouseenter', function () { b.style.background = 'var(--hover-surface)'; b.style.color = 'var(--fg)'; });
    b.addEventListener('mouseleave', function () { b.style.background = 'none'; b.style.color = 'var(--fg-muted)'; });
    b.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    return b;
  }
  function isBar(el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = getComputedStyle(el), h = el.offsetHeight;
    return (el.tagName === 'HEADER' || cs.display === 'flex') && cs.flexDirection !== 'column' && h >= 40 && h <= 64;
  }
  function wire() {
    sidebars().forEach(function (sb) {
      var pane = sb.nextElementSibling;
      while (pane && (pane.offsetWidth === 0 || pane.tagName === 'SCRIPT')) pane = pane.nextElementSibling;
      if (!pane || pane.querySelector('[data-op-sbtoggle]')) { if (!sb.__opDone) { sb.__opDone = true; apply(sb, false); } return; }
      var first = pane.firstElementChild;
      if (isBar(first)) {
        Array.prototype.forEach.call(first.querySelectorAll('button[aria-label]'), function (x) { if (/sidebar/i.test(x.getAttribute('aria-label'))) x.style.display = 'none'; });
        var b = makeBtn(); b.style.marginRight = '4px';
        first.insertBefore(b, first.firstChild);
        if (parseFloat(getComputedStyle(first).paddingLeft) > 14) first.style.paddingLeft = '14px';
      } else {
        var bar = document.createElement('div');
        bar.setAttribute('data-op-pagebar', '');
        bar.style.cssText = 'flex:none;display:flex;align-items:center;height:48px;padding-left:14px;box-sizing:border-box';
        bar.appendChild(makeBtn());
        if (getComputedStyle(pane).display !== 'flex') { pane.style.display = 'flex'; pane.style.flexDirection = 'column'; }
        pane.insertBefore(bar, first);
      }
      sb.__opDone = true; apply(sb, false);
    });
    sync(false);
  }
  document.addEventListener('keydown', function (e) {
    if ((mac ? e.metaKey : e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
      var t = (e.target.tagName || '').toLowerCase(); if (t === 'textarea' || (t === 'input' && e.target.type === 'text' && e.target.value)) return;
      e.preventDefault(); toggle();
    }
  });
  var q = false;
  new MutationObserver(function () { if (!q) { q = true; requestAnimationFrame(function () { q = false; wire(); }); } }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState !== 'loading') setTimeout(wire, 0); else document.addEventListener('DOMContentLoaded', wire);
})();
