package chrome

// listScript reads the page for a bot: the visible things it can act on,
// each stamped with a ref (`data-oppenheimer-ref`) a later action finds it
// by, and, when asked, the page's text. It answers a JSON string. A password
// field's value is never read.
const listScript = `(function (maxElements, wantText) {
  var ATTR = 'data-oppenheimer-ref';
  document.querySelectorAll('[' + ATTR + ']').forEach(function (old) { old.removeAttribute(ATTR); });
  var selector = 'a[href],button,input:not([type=hidden]),textarea,select,summary,' +
    '[role=button],[role=link],[role=checkbox],[role=radio],[role=tab],[role=menuitem],' +
    '[role=option],[role=switch],[role=textbox],[role=combobox],[contenteditable=""],[contenteditable=true]';
  function cut(text) { return (text || '').replace(/\s+/g, ' ').trim().slice(0, 200); }
  function roleOf(el) {
    var role = el.getAttribute('role');
    if (role) return role;
    var tag = el.tagName.toLowerCase();
    if (tag === 'a') return 'link';
    if (tag === 'button' || tag === 'summary') return 'button';
    if (tag === 'select') return 'select';
    if (tag === 'textarea') return 'textbox';
    if (tag === 'input') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'checkbox' || type === 'radio') return type;
      if (type === 'submit' || type === 'button' || type === 'reset') return 'button';
      return 'textbox';
    }
    return 'textbox';
  }
  function nameOf(el) {
    var label = el.getAttribute('aria-label');
    if (!label && el.labels && el.labels.length) label = el.labels[0].innerText;
    if (!label && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el.tagName !== 'SELECT') label = el.innerText;
    if (!label && (el.type === 'submit' || el.type === 'button')) label = el.value;
    return cut(label || el.getAttribute('placeholder') || el.getAttribute('title') ||
      el.getAttribute('alt') || el.getAttribute('name') || '');
  }
  function valueOf(el) {
    var tag = el.tagName;
    if (tag === 'INPUT') {
      var type = (el.getAttribute('type') || 'text').toLowerCase();
      if (type === 'password') return el.value ? '(hidden)' : '';
      if (type === 'checkbox' || type === 'radio') return el.checked ? 'checked' : '';
      if (type === 'submit' || type === 'button' || type === 'reset') return '';
      return cut(el.value);
    }
    if (tag === 'TEXTAREA') return cut(el.value);
    if (tag === 'SELECT') return cut(el.selectedOptions.length ? el.selectedOptions[0].text : '');
    return '';
  }
  var seen = [];
  document.querySelectorAll(selector).forEach(function (el) {
    var box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    var style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || el.disabled) return;
    var inView = box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
    seen.push({ el: el, inView: inView });
  });
  // What is on screen now comes first when the page holds more than is listed.
  seen.sort(function (a, b) { return (b.inView ? 1 : 0) - (a.inView ? 1 : 0); });
  var elements = seen.slice(0, maxElements).map(function (item, index) {
    var ref = 'e' + (index + 1);
    item.el.setAttribute(ATTR, ref);
    var entry = { ref: ref, role: roleOf(item.el), name: nameOf(item.el) };
    var value = valueOf(item.el);
    if (value) entry.value = value;
    return entry;
  });
  return JSON.stringify({
    title: document.title.slice(0, 300),
    elements: elements,
    more: seen.length > maxElements,
    text: wantText && document.body ? document.body.innerText : ''
  });
})`

// pointScript finds the element a ref names, brings it into view, makes a
// link open in this tab rather than a new one the bot would not see, and
// answers the middle of it as "x,y", or "" when the page has no such ref.
const pointScript = `(function (ref) {
  var el = document.querySelector('[data-oppenheimer-ref="' + ref + '"]');
  if (!el) return '';
  el.scrollIntoView({ block: 'center', inline: 'center' });
  var link = el.closest('a[target]');
  if (link) link.removeAttribute('target');
  var box = el.getBoundingClientRect();
  return Math.round(box.left + box.width / 2) + ',' + Math.round(box.top + box.height / 2);
})`

// clearScript empties the field a ref names before text is typed into it,
// so typing replaces what it held, as a person selecting it all would.
const clearScript = `(function (ref) {
  var el = document.querySelector('[data-oppenheimer-ref="' + ref + '"]');
  if (!el) return false;
  el.focus();
  if (typeof el.select === 'function') el.select();
  else if (el.isContentEditable) document.execCommand('selectAll');
  return true;
})`
