/* @ds-bundle: {"format":4,"namespace":"OppenheimerDesignSystem_9a2556","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"CardHeader","sourcePath":"components/core/Card.jsx"},{"name":"CardBody","sourcePath":"components/core/Card.jsx"},{"name":"CardFooter","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"ICONS","sourcePath":"components/core/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/Icon.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Kbd","sourcePath":"components/core/Kbd.jsx"},{"name":"Separator","sourcePath":"components/core/Separator.jsx"},{"name":"Wordmark","sourcePath":"components/core/Wordmark.jsx"},{"name":"AreaChart","sourcePath":"components/data/AreaChart.jsx"},{"name":"Sparkline","sourcePath":"components/data/AreaChart.jsx"},{"name":"BarChart","sourcePath":"components/data/BarChart.jsx"},{"name":"ChartLegend","sourcePath":"components/data/BarChart.jsx"},{"name":"DonutChart","sourcePath":"components/data/DonutChart.jsx"},{"name":"EmptyState","sourcePath":"components/data/EmptyState.jsx"},{"name":"ProgressBar","sourcePath":"components/data/ProgressBar.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Combobox","sourcePath":"components/forms/Combobox.jsx"},{"name":"Field","sourcePath":"components/forms/Field.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"RadioGroup","sourcePath":"components/forms/RadioGroup.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"SidebarHeader","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"SidebarScroll","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"SidebarFooter","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"SidebarSection","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"SidebarItem","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"ThemeToggle","sourcePath":"components/navigation/ThemeToggle.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"},{"name":"DropdownMenu","sourcePath":"components/overlays/DropdownMenu.jsx"},{"name":"Tooltip","sourcePath":"components/overlays/Tooltip.jsx"},{"name":"SessionItem","sourcePath":"components/terminal/SessionItem.jsx"},{"name":"Terminal","sourcePath":"components/terminal/Terminal.jsx"},{"name":"TerminalLine","sourcePath":"components/terminal/Terminal.jsx"},{"name":"TerminalTabs","sourcePath":"components/terminal/TerminalTabs.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"5db4859c0c0c","components/core/Badge.jsx":"7f498340b46d","components/core/Button.jsx":"d0ccd6e9f710","components/core/Card.jsx":"282984f8c699","components/core/Chip.jsx":"9a3231169962","components/core/Icon.jsx":"048f2c46c91e","components/core/IconButton.jsx":"7e4f5e748885","components/core/Kbd.jsx":"b113edafb329","components/core/Separator.jsx":"d5a0ba32327d","components/core/Wordmark.jsx":"cfda0df6e341","components/data/AreaChart.jsx":"8598e4744e34","components/data/BarChart.jsx":"5753f97a29a1","components/data/DonutChart.jsx":"657fc9bcc56a","components/data/EmptyState.jsx":"077e5f8fff28","components/data/ProgressBar.jsx":"90bf7015a056","components/data/StatCard.jsx":"ad45bf2e6ae2","components/data/Table.jsx":"a46e2aa74dec","components/forms/Checkbox.jsx":"a597e8664f08","components/forms/Combobox.jsx":"61feb7e7b6fd","components/forms/Field.jsx":"14b0c51f59f3","components/forms/Input.jsx":"fb9e029e4f08","components/forms/RadioGroup.jsx":"1a59832d19f1","components/forms/Select.jsx":"70323ef650f2","components/forms/Switch.jsx":"19e8a319caea","components/forms/Textarea.jsx":"b1115379a64d","components/navigation/Sidebar.jsx":"e2878ac3f963","components/navigation/Tabs.jsx":"60a6b0a8e2fa","components/navigation/ThemeToggle.jsx":"fecb160cf3fe","components/overlays/Dialog.jsx":"b0f6ddbe08ea","components/overlays/DropdownMenu.jsx":"1aba38c39c36","components/overlays/Tooltip.jsx":"2f575f0ea64b","components/terminal/SessionItem.jsx":"e44aef47d42e","components/terminal/Terminal.jsx":"dbaf902e5480","components/terminal/TerminalTabs.jsx":"d6742780d6d5","ui_kits/console/AppShell.jsx":"bb7795224fef","ui_kits/console/AuthScreens.jsx":"a8cdc2cc18a1","ui_kits/console/Overview.jsx":"e9a7eed2c2cd","ui_kits/console/RunDetail.jsx":"77bf5f0a3bfa"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.OppenheimerDesignSystem_9a2556 = window.OppenheimerDesignSystem_9a2556 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Initials or a photo. Never an illustrated placeholder. */
function Avatar({
  name = '',
  src,
  size = 'md',
  accent = false,
  className = '',
  ...rest
}) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('');
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['op-avatar', `op-avatar--${size}`, accent ? 'op-avatar--accent' : '', className].filter(Boolean).join(' '),
    title: name || undefined
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A read-only status label. If it can be clicked or removed, use Chip instead. */
function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['op-badge', `op-badge--${tone}`, className].filter(Boolean).join(' ')
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: "op-badge__dot"
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The content container. Tonal contrast and radius carry it — no shadow. */
function Card({
  children,
  flat = false,
  padded = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-card', flat ? 'op-card--flat' : '', padded ? 'op-card--pad' : '', className].filter(Boolean).join(' ')
  }, rest), children);
}
function CardHeader({
  title,
  description,
  action,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-card__header', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "op-card__title"
  }, title), description && /*#__PURE__*/React.createElement("div", {
    className: "op-card__desc"
  }, description)), action);
}
function CardBody({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-card__body', className].filter(Boolean).join(' ')
  }, rest), children);
}
function CardFooter({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-card__footer', className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Card, CardHeader, CardBody, CardFooter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Oppenheimer icon set — Lucide (ISC), 24px grid, 2px stroke, round caps/joins.
   Glyph source of truth: assets/icons/*.svg. Keep this map and that folder in sync.
   Icons always inherit currentColor and never carry their own color. */
const ICONS = {
  activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  'alert-circle': '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'arrow-up': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  boxes: '<path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z"/><path d="m7 16.5-4.74-2.85"/><path d="m7 16.5 5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z"/><path d="m17 16.5-5-3"/><path d="m17 16.5 4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z"/><path d="M12 8 7.26 5.15"/><path d="m12 8 4.74-2.85"/><path d="M12 13.5V8"/>',
  calendar: '<path d="M8 2v3"/><path d="M16 2v3"/><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="10"/><path d="m16 9-5.5 5.5L8 12"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  'chevron-up': '<path d="m18 15-6-6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  cpu: '<path d="M12 20v2"/><path d="M12 2v2"/><path d="M17 20v2"/><path d="M17 2v2"/><path d="M2 12h2"/><path d="M2 17h2"/><path d="M2 7h2"/><path d="M20 12h2"/><path d="M20 17h2"/><path d="M20 7h2"/><path d="M7 20v2"/><path d="M7 2v2"/><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  'external-link': '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
  'file-text': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  filter: '<path d="M2 5h20"/><path d="M6 12h12"/><path d="M9 19h6"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  'git-branch': '<path d="M15 6a9 9 0 0 0-9 9V3"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/>',
  'git-pull-request': '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  'help-circle': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  key: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5" fill="currentColor"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'log-out': '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  mail: '<path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  mic: '<path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/>',
  minus: '<path d="M5 12h14"/>',
  moon: '<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/>',
  'panel-left': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  paperclip: '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  settings: '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  'slash': '<rect width="18" height="18" x="3" y="3" rx="2"/><line x1="9" x2="15" y1="15" y2="9"/>',
  sliders: '<path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  terminal: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
  'trending-down': '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
  'trending-up': '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  workflow: '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  zap: '<path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"/>'
};
const ICON_NAMES = Object.keys(ICONS);
function Icon({
  name,
  size = 16,
  strokeWidth = 2,
  className = '',
  style,
  spin = false,
  ...rest
}) {
  const body = ICONS[name];
  if (!body) return null;
  return /*#__PURE__*/React.createElement("svg", _extends({
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    focusable: "false",
    className: className,
    style: {
      display: 'block',
      flex: 'none',
      animation: spin ? 'op-spin 700ms linear infinite' : undefined,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: body
    }
  }, rest));
}
Object.assign(__ds_scope, { ICONS, ICON_NAMES, Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: 'sm',
  md: 'md',
  lg: 'lg'
};

/** The one action control. Primary is rationed — one per view. */
function Button({
  children,
  variant = 'secondary',
  size = 'md',
  shape = 'pill',
  iconLeft,
  iconRight,
  loading = false,
  disabled = false,
  block = false,
  as = 'button',
  className = '',
  ...rest
}) {
  const Tag = as;
  const cls = ['op-btn', `op-btn--${variant}`, `op-btn--${SIZES[size] || 'md'}`, shape === 'square' ? 'op-btn--sq' : '', block ? 'op-btn--block' : '', className].filter(Boolean).join(' ');
  const glyph = size === 'lg' ? 17 : size === 'sm' ? 13 : 15;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls,
    disabled: Tag === 'button' ? disabled || loading : undefined,
    "aria-disabled": Tag !== 'button' && (disabled || loading) ? 'true' : undefined
  }, rest), loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "loader",
    size: glyph,
    spin: true
  }) : iconLeft ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: glyph
  }) : null, children, iconRight && !loading ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: glyph
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A selectable or dismissible token: filters, chosen values, model tags. */
function Chip({
  children,
  selected = false,
  variant = 'outline',
  dotColor,
  icon,
  onRemove,
  disabled = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    "data-selected": selected ? 'true' : 'false',
    className: ['op-chip', variant === 'solid' ? 'op-chip--solid' : '', className].filter(Boolean).join(' ')
  }, rest), dotColor && /*#__PURE__*/React.createElement("span", {
    className: "op-chip__dot",
    style: {
      background: dotColor
    }
  }), icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13
  }), children, onRemove && /*#__PURE__*/React.createElement("span", {
    role: "button",
    tabIndex: -1,
    "aria-label": "Remove",
    className: "op-chip__x",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "x",
    size: 12
  })));
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A button whose whole label is a glyph. Always give it an aria-label. */
function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  shape = 'pill',
  className = '',
  ...rest
}) {
  const cls = ['op-iconbtn', `op-iconbtn--${size}`, variant !== 'ghost' ? `op-iconbtn--${variant}` : '', shape === 'square' ? 'op-iconbtn--sq' : '', className].filter(Boolean).join(' ');
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    "aria-label": label,
    title: label
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === 'lg' ? 18 : size === 'sm' ? 14 : 16
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Kbd.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A keyboard key. Used in menus and the command affordance. */
function Kbd({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("kbd", _extends({
    className: ['op-kbd', className].filter(Boolean).join(' ')
  }, rest), children);
}
Object.assign(__ds_scope, { Kbd });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kbd.jsx", error: String((e && e.message) || e) }); }

// components/core/Separator.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A one-pixel rule. Use sparingly — whitespace divides better than lines. */
function Separator({
  orientation = 'horizontal',
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "separator",
    "aria-orientation": orientation,
    className: ['op-sep', orientation === 'vertical' ? 'op-sep--v' : 'op-sep--h', className].filter(Boolean).join(' ')
  }, rest));
}
Object.assign(__ds_scope, { Separator });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Separator.jsx", error: String((e && e.message) || e) }); }

// components/core/Wordmark.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The brand mark. No logotype file exists — the name set in SF Pro Display 600
 *  with tight tracking IS the mark. Never substitute a drawn symbol. */
function Wordmark({
  size = 22,
  product,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['op-wordmark', className].filter(Boolean).join(' '),
    style: {
      fontSize: size
    }
  }, rest), "Oppenheimer", product && /*#__PURE__*/React.createElement("span", {
    className: "op-wordmark__sub"
  }, product));
}
Object.assign(__ds_scope, { Wordmark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Wordmark.jsx", error: String((e && e.message) || e) }); }

// components/data/AreaChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Shared geometry helpers for the chart family. */
const pad = {
  t: 10,
  r: 8,
  b: 22,
  l: 34
};
function scale(v, min, max, a, b) {
  if (max === min) return (a + b) / 2;
  return a + (v - min) / (max - min) * (b - a);
}

/** A trend over time. One to three series; more becomes unreadable. */
function AreaChart({
  series = [],
  labels = [],
  height = 200,
  area = true,
  yTicks = 4,
  yFormat = v => v,
  className = '',
  ...rest
}) {
  const w = 640,
    h = height;
  const all = series.flatMap(s => s.data);
  const max = Math.max(...all, 0) * 1.08 || 1;
  const min = 0;
  const n = Math.max(labels.length, ...series.map(s => s.data.length));
  const x = i => scale(i, 0, Math.max(n - 1, 1), pad.l, w - pad.r);
  const y = v => scale(v, min, max, h - pad.b, pad.t);
  const ticks = Array.from({
    length: yTicks + 1
  }, (_, i) => min + (max - min) / yTicks * i);
  return /*#__PURE__*/React.createElement("svg", _extends({
    className: ['op-chart', className].filter(Boolean).join(' '),
    viewBox: `0 0 ${w} ${h}`,
    preserveAspectRatio: "none",
    style: {
      height
    },
    role: "img"
  }, rest), ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    className: "op-chart__grid",
    x1: pad.l,
    x2: w - pad.r,
    y1: y(t),
    y2: y(t)
  }), /*#__PURE__*/React.createElement("text", {
    className: "op-chart__axis",
    x: pad.l - 8,
    y: y(t) + 3,
    textAnchor: "end"
  }, yFormat(Math.round(t))))), labels.map((l, i) => /*#__PURE__*/React.createElement("text", {
    key: l + i,
    className: "op-chart__axis",
    x: x(i),
    y: h - 6,
    textAnchor: "middle"
  }, l)), series.map((s, si) => {
    const color = s.color || `var(--chart-${si % 5 + 1})`;
    const pts = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    return /*#__PURE__*/React.createElement("g", {
      key: s.name || si
    }, area && /*#__PURE__*/React.createElement("polygon", {
      points: `${x(0)},${y(min)} ${pts} ${x(s.data.length - 1)},${y(min)}`,
      fill: color,
      opacity: series.length > 1 ? 0.08 : 0.12
    }), /*#__PURE__*/React.createElement("polyline", {
      className: "op-chart__line",
      points: pts,
      stroke: color,
      vectorEffect: "non-scaling-stroke"
    }));
  }));
}

/** Compact inline trend — no axes, no labels. Lives inside StatCard. */
function Sparkline({
  data = [],
  color = 'var(--chart-1)',
  width = 96,
  height = 30,
  className = ''
}) {
  const max = Math.max(...data),
    min = Math.min(...data);
  const pts = data.map((v, i) => `${scale(i, 0, data.length - 1, 1, width - 1)},${scale(v, min, max, height - 2, 2)}`).join(' ');
  return /*#__PURE__*/React.createElement("svg", {
    className: className,
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`,
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: pts,
    fill: "none",
    stroke: color,
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(__ds_scope, { AreaChart, Sparkline });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/AreaChart.jsx", error: String((e && e.message) || e) }); }

// components/data/BarChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Comparison across a small set of categories. Stack only when parts sum to a whole. */
function BarChart({
  labels = [],
  series = [],
  height = 200,
  stacked = false,
  yTicks = 4,
  yFormat = v => v,
  className = '',
  ...rest
}) {
  const w = 640,
    h = height,
    pad = {
      t: 10,
      r: 8,
      b: 22,
      l: 34
    };
  const totals = labels.map((_, i) => series.reduce((s, ser) => s + (ser.data[i] || 0), 0));
  const max = (stacked ? Math.max(...totals) : Math.max(...series.flatMap(s => s.data), 0)) * 1.12 || 1;
  const y = v => h - pad.b - v / max * (h - pad.b - pad.t);
  const band = (w - pad.l - pad.r) / Math.max(labels.length, 1);
  const barW = stacked ? Math.min(30, band * 0.46) : Math.min(18, band * 0.62 / series.length);
  const ticks = Array.from({
    length: yTicks + 1
  }, (_, i) => max / yTicks * i);
  return /*#__PURE__*/React.createElement("svg", _extends({
    className: ['op-chart', className].filter(Boolean).join(' '),
    viewBox: `0 0 ${w} ${h}`,
    style: {
      height
    },
    role: "img"
  }, rest), ticks.map((t, i) => /*#__PURE__*/React.createElement("g", {
    key: i
  }, /*#__PURE__*/React.createElement("line", {
    className: "op-chart__grid",
    x1: pad.l,
    x2: w - pad.r,
    y1: y(t),
    y2: y(t)
  }), /*#__PURE__*/React.createElement("text", {
    className: "op-chart__axis",
    x: pad.l - 8,
    y: y(t) + 3,
    textAnchor: "end"
  }, yFormat(Math.round(t))))), labels.map((l, i) => {
    const cx = pad.l + band * i + band / 2;
    let acc = 0;
    return /*#__PURE__*/React.createElement("g", {
      key: l + i
    }, series.map((s, si) => {
      const v = s.data[i] || 0;
      const color = s.color || `var(--chart-${si % 5 + 1})`;
      if (stacked) {
        const yTop = y(acc + v),
          yBot = y(acc);
        acc += v;
        return /*#__PURE__*/React.createElement("rect", {
          key: si,
          className: "op-chart__bar",
          x: cx - barW / 2,
          y: yTop,
          width: barW,
          height: Math.max(yBot - yTop, 0),
          fill: color,
          rx: "2"
        });
      }
      const groupW = barW * series.length + 3 * (series.length - 1);
      const x0 = cx - groupW / 2 + si * (barW + 3);
      return /*#__PURE__*/React.createElement("rect", {
        key: si,
        className: "op-chart__bar",
        x: x0,
        y: y(v),
        width: barW,
        height: Math.max(h - pad.b - y(v), 0),
        fill: color,
        rx: "2"
      });
    }), /*#__PURE__*/React.createElement("text", {
      className: "op-chart__axis",
      x: cx,
      y: h - 6,
      textAnchor: "middle"
    }, l));
  }));
}

/** Legend for any chart. Order must match the series order. */
function ChartLegend({
  items = [],
  className = ''
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: ['op-legend', className].filter(Boolean).join(' ')
  }, items.map((it, i) => /*#__PURE__*/React.createElement("span", {
    key: it.label,
    className: "op-legend__item"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-legend__dot",
    style: {
      background: it.color || `var(--chart-${i % 5 + 1})`
    }
  }), it.label, it.value != null && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--fg)',
      fontFamily: 'var(--font-mono)'
    }
  }, it.value))));
}
Object.assign(__ds_scope, { BarChart, ChartLegend });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BarChart.jsx", error: String((e && e.message) || e) }); }

// components/data/DonutChart.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Parts of one whole, four slices maximum. Never for trends. */
function DonutChart({
  data = [],
  size = 160,
  thickness = 14,
  centerValue,
  centerCaption,
  className = '',
  ...rest
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-donut', className].filter(Boolean).join(' '),
    style: {
      position: 'relative',
      width: size,
      height: size
    }
  }, rest), /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: "img"
  }, /*#__PURE__*/React.createElement("g", {
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  }, data.map((d, i) => {
    const len = d.value / total * c;
    const el = /*#__PURE__*/React.createElement("circle", {
      key: d.label,
      cx: size / 2,
      cy: size / 2,
      r: r,
      fill: "none",
      stroke: d.color || `var(--chart-${i % 5 + 1})`,
      strokeWidth: thickness,
      strokeDasharray: `${Math.max(len - 2, 0)} ${c - Math.max(len - 2, 0)}`,
      strokeDashoffset: -offset,
      strokeLinecap: "butt"
    });
    offset += len;
    return el;
  }))), (centerValue || centerCaption) && /*#__PURE__*/React.createElement("div", {
    className: "op-donut__center",
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-donut__value"
  }, centerValue), centerCaption && /*#__PURE__*/React.createElement("div", {
    className: "op-donut__caption"
  }, centerCaption)));
}
Object.assign(__ds_scope, { DonutChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DonutChart.jsx", error: String((e && e.message) || e) }); }

// components/data/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Nothing here yet. Always name the next action. */
function EmptyState({
  icon = 'layers',
  title,
  description,
  action,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-empty', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "op-empty__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 19
  })), /*#__PURE__*/React.createElement("div", {
    className: "op-empty__title"
  }, title), description && /*#__PURE__*/React.createElement("div", {
    className: "op-empty__desc"
  }, description), action);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressBar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Determinate progress only. For unknown duration use a spinning Icon. */
function ProgressBar({
  value = 0,
  max = 100,
  color,
  size = 'md',
  className = '',
  ...rest
}) {
  const pct = Math.max(0, Math.min(100, value / max * 100));
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemax": max,
    className: ['op-progress', size === 'sm' ? 'op-progress--sm' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "op-progress__fill",
    style: {
      width: `${pct}%`,
      background: color
    }
  }));
}
Object.assign(__ds_scope, { ProgressBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressBar.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** One headline number with its trend. Four across is the dashboard maximum. */
function StatCard({
  label,
  value,
  unit,
  delta,
  direction = 'flat',
  caption,
  icon,
  spark,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-card op-stat', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "op-stat__label"
  }, icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 14
  }), label), /*#__PURE__*/React.createElement("div", {
    className: "op-stat__row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-stat__value"
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '.55em',
      marginLeft: 3,
      color: 'var(--fg-subtle)'
    }
  }, unit)), spark), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, delta != null && /*#__PURE__*/React.createElement("span", {
    className: "op-stat__delta",
    "data-dir": direction
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: direction === 'down' ? 'trending-down' : direction === 'up' ? 'trending-up' : 'minus',
    size: 13
  }), delta), caption && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 'var(--text-xs)',
      color: 'var(--fg-subtle)'
    }
  }, caption)));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Rows of records. Right-align and mono-set anything numeric. */
function Table({
  columns = [],
  rows = [],
  hover = true,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "op-table-wrap"
  }, /*#__PURE__*/React.createElement("table", _extends({
    className: ['op-table', hover ? 'op-table--hover' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    "data-align": c.align || 'left',
    style: c.width ? {
      width: c.width
    } : undefined
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: r.id || i
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    "data-align": c.align || 'left',
    "data-num": c.numeric ? 'true' : 'false'
  }, c.render ? c.render(r) : r[c.key])))))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A binary choice inside a form you submit. For instant settings use Switch. */
function Checkbox({
  label,
  description,
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  className = '',
  ...rest
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return /*#__PURE__*/React.createElement("label", {
    "data-disabled": disabled ? 'true' : 'false',
    className: ['op-check', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    ref: ref,
    type: "checkbox",
    checked: checked,
    disabled: disabled,
    onChange: onChange
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "op-check__box"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: indeterminate ? 'minus' : 'check',
    size: 12,
    strokeWidth: 3
  })), (label || description) && /*#__PURE__*/React.createElement("span", {
    className: "op-check__text"
  }, label, description && /*#__PURE__*/React.createElement("span", {
    className: "op-check__desc"
  }, description)));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Combobox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A Select you can type into. Use whenever the list exceeds ~8 entries. */
function Combobox({
  options = [],
  value,
  onChange,
  placeholder = 'Search…',
  emptyText = 'No matches',
  size = 'md',
  disabled = false,
  className = '',
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = e => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);
  const current = options.find(o => o.value === value);
  const list = options.filter(o => o.label.toLowerCase().includes(query.trim().toLowerCase()));
  const commit = o => {
    onChange && onChange(o.value);
    setOpen(false);
    setQuery('');
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive(i => Math.min(i + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && list[active]) {
      e.preventDefault();
      commit(list[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    ref: ref,
    className: ['op-select', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: `op-input op-input--${size}`,
    "data-disabled": disabled ? 'true' : 'false'
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-input__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "search",
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    className: "op-input__el",
    disabled: disabled,
    placeholder: current && !open ? current.label : placeholder,
    value: open ? query : '',
    onChange: e => {
      setQuery(e.target.value);
      setActive(0);
      setOpen(true);
    },
    onFocus: () => setOpen(true),
    onKeyDown: onKey,
    role: "combobox",
    "aria-expanded": open,
    "aria-autocomplete": "list"
  }), /*#__PURE__*/React.createElement("span", {
    className: "op-select__chev",
    "data-open": open
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 15
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "op-listbox",
    role: "listbox"
  }, list.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "op-listbox__empty"
  }, emptyText), list.map((o, i) => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "option",
    "aria-selected": o.value === value,
    "data-selected": o.value === value ? 'true' : 'false',
    "data-active": i === active ? 'true' : 'false',
    className: "op-option",
    onMouseEnter: () => setActive(i),
    onClick: () => commit(o)
  }, o.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: o.icon,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "op-option__label"
  }, o.label), o.meta && /*#__PURE__*/React.createElement("span", {
    className: "op-option__desc"
  }, o.meta), /*#__PURE__*/React.createElement("span", {
    className: "op-option__check"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 14
  }))))));
}
Object.assign(__ds_scope, { Combobox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Combobox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Field.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Label + control + hint/error wrapper. Wrap every input in one. */
function Field({
  label,
  hint,
  error,
  required = false,
  htmlFor,
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-field', className].filter(Boolean).join(' ')
  }, rest), label && /*#__PURE__*/React.createElement("label", {
    className: "op-label",
    htmlFor: htmlFor
  }, label, required && /*#__PURE__*/React.createElement("span", {
    className: "op-label__req"
  }, "*")), children, error ? /*#__PURE__*/React.createElement("span", {
    className: "op-error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "op-hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Field.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Single-line text entry. 10px radius; `pill` only for global search. */
function Input({
  size = 'md',
  iconLeft,
  iconRight,
  trailing,
  invalid = false,
  disabled = false,
  pill = false,
  className = '',
  wrapperClassName = '',
  ...rest
}) {
  const glyph = size === 'lg' ? 17 : 15;
  return /*#__PURE__*/React.createElement("div", {
    "data-invalid": invalid ? 'true' : 'false',
    "data-disabled": disabled ? 'true' : 'false',
    className: ['op-input', `op-input--${size}`, pill ? 'op-input--pill' : '', wrapperClassName].filter(Boolean).join(' ')
  }, iconLeft && /*#__PURE__*/React.createElement("span", {
    className: "op-input__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconLeft,
    size: glyph
  })), /*#__PURE__*/React.createElement("input", _extends({
    className: ['op-input__el', className].filter(Boolean).join(' '),
    disabled: disabled
  }, rest)), iconRight && /*#__PURE__*/React.createElement("span", {
    className: "op-input__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: glyph
  })), trailing);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/RadioGroup.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** One of several mutually exclusive options, all visible at once. */
function RadioGroup({
  name,
  options = [],
  value,
  onChange,
  row = false,
  disabled = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "radiogroup",
    className: ['op-radiogroup', row ? 'op-radiogroup--row' : '', className].filter(Boolean).join(' ')
  }, rest), options.map(o => /*#__PURE__*/React.createElement("label", {
    key: o.value,
    "data-disabled": disabled || o.disabled ? 'true' : 'false',
    className: "op-check op-check--radio"
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: name,
    value: o.value,
    checked: value === o.value,
    disabled: disabled || o.disabled,
    onChange: () => onChange && onChange(o.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "op-check__box"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "8",
    height: "8",
    viewBox: "0 0 8 8",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "4",
    cy: "4",
    r: "4",
    fill: "currentColor"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "op-check__text"
  }, o.label, o.description && /*#__PURE__*/React.createElement("span", {
    className: "op-check__desc"
  }, o.description)))));
}
Object.assign(__ds_scope, { RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/RadioGroup.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Pick one of a known, short list. For long or searchable lists use Combobox. */
function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  size = 'md',
  disabled = false,
  id,
  className = '',
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const current = options.find(o => o.value === value);
  return /*#__PURE__*/React.createElement("div", _extends({
    ref: ref,
    className: ['op-select', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    id: id,
    disabled: disabled,
    "data-open": open ? 'true' : 'false',
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    className: `op-select__trigger op-input--${size}`,
    onClick: () => setOpen(o => !o)
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-select__value",
    "data-placeholder": current ? 'false' : 'true'
  }, current ? current.label : placeholder), /*#__PURE__*/React.createElement("span", {
    className: "op-select__chev"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 15
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "op-listbox",
    role: "listbox"
  }, options.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "option",
    "aria-selected": o.value === value,
    "data-selected": o.value === value ? 'true' : 'false',
    className: "op-option",
    onClick: () => {
      onChange && onChange(o.value);
      setOpen(false);
    }
  }, o.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: o.icon,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    className: "op-option__label"
  }, o.label, o.description && /*#__PURE__*/React.createElement("span", {
    className: "op-option__desc",
    style: {
      display: 'block'
    }
  }, o.description)), /*#__PURE__*/React.createElement("span", {
    className: "op-option__check"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 14
  }))))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** An instantly-applied on/off setting. If it needs a Save button, use Checkbox. */
function Switch({
  label,
  checked,
  onChange,
  disabled = false,
  size = 'md',
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    "data-disabled": disabled ? 'true' : 'false',
    className: ['op-switch', size === 'sm' ? 'op-switch--sm' : '', className].filter(Boolean).join(' ')
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    role: "switch",
    checked: checked,
    disabled: disabled,
    onChange: onChange
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "op-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-switch__thumb"
  })), label && /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Multi-line entry. Grows vertically only. */
function Textarea({
  className = '',
  rows = 4,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("textarea", _extends({
    rows: rows,
    className: ['op-textarea', className].filter(Boolean).join(' ')
  }, rest));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The app's primary navigation rail. Compose from the parts below. */
function Sidebar({
  children,
  collapsed = false,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    "data-collapsed": collapsed ? 'true' : 'false',
    className: ['op-sidebar', className].filter(Boolean).join(' ')
  }, rest), children);
}
function SidebarHeader({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-sidebar__head', className].filter(Boolean).join(' ')
  }, rest), children);
}
function SidebarScroll({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-sidebar__scroll', className].filter(Boolean).join(' ')
  }, rest), children);
}
function SidebarFooter({
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-sidebar__foot', className].filter(Boolean).join(' ')
  }, rest), children);
}
function SidebarSection({
  title,
  action,
  children,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-sidebar__section', className].filter(Boolean).join(' ')
  }, rest), (title || action) && /*#__PURE__*/React.createElement("div", {
    className: "op-sidebar__sectionhead"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-sidebar__sectiontitle"
  }, title), action), children);
}
function SidebarItem({
  icon,
  dotColor,
  label,
  meta,
  active = false,
  muted = false,
  as = 'button',
  className = '',
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    "data-active": active ? 'true' : 'false',
    type: Tag === 'button' ? 'button' : undefined,
    className: ['op-navitem', muted ? 'op-navitem--muted' : '', className].filter(Boolean).join(' ')
  }, rest), dotColor && /*#__PURE__*/React.createElement("span", {
    className: "op-navitem__dot",
    style: {
      background: dotColor
    }
  }), icon && /*#__PURE__*/React.createElement("span", {
    className: "op-navitem__icon"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })), /*#__PURE__*/React.createElement("span", {
    className: "op-navitem__label"
  }, label), meta && /*#__PURE__*/React.createElement("span", {
    className: "op-navitem__meta"
  }, meta));
}
Object.assign(__ds_scope, { Sidebar, SidebarHeader, SidebarScroll, SidebarFooter, SidebarSection, SidebarItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Switch between peer views of the same object. `segment` for in-card filters,
 *  `line` for page-level sections. */
function Tabs({
  tabs = [],
  value,
  onChange,
  variant = 'segment',
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    className: ['op-tabs', variant === 'line' ? 'op-tabs--line' : '', className].filter(Boolean).join(' ')
  }, rest), tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.value,
    type: "button",
    role: "tab",
    "aria-selected": t.value === value,
    "data-active": t.value === value ? 'true' : 'false',
    className: "op-tab",
    onClick: () => onChange && onChange(t.value)
  }, t.icon && /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 14
  }), t.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ThemeToggle.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Light/dark switch. Writes `data-theme` on the element you point it at. */
function ThemeToggle({
  theme = 'light',
  onChange,
  target,
  className = '',
  ...rest
}) {
  const set = next => {
    const el = target || (typeof document !== 'undefined' ? document.documentElement : null);
    if (el) el.setAttribute('data-theme', next);
    onChange && onChange(next);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-themetoggle', className].filter(Boolean).join(' '),
    role: "group",
    "aria-label": "Theme"
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Light",
    "data-active": theme === 'light' ? 'true' : 'false',
    onClick: () => set('light')
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sun",
    size: 14
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Dark",
    "data-active": theme === 'dark' ? 'true' : 'false',
    onClick: () => set('dark')
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "moon",
    size: 14
  })));
}
Object.assign(__ds_scope, { ThemeToggle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ThemeToggle.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A modal decision. One per flow; never stack two. */
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className = '',
  ...rest
}) {
  React.useEffect(() => {
    if (!open) return undefined;
    const esc = e => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "op-scrim",
    onMouseDown: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    className: ['op-dialog', size === 'lg' ? 'op-dialog--lg' : '', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "op-dialog__head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "op-dialog__title"
  }, title), onClose && /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    label: "Close",
    size: "sm",
    onClick: onClose
  })), description && /*#__PURE__*/React.createElement("div", {
    className: "op-dialog__desc"
  }, description), children && /*#__PURE__*/React.createElement("div", {
    className: "op-dialog__body"
  }, children), footer && /*#__PURE__*/React.createElement("div", {
    className: "op-dialog__foot"
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlays/DropdownMenu.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Actions on a thing. Never navigation — that belongs in the sidebar. */
function DropdownMenu({
  trigger,
  items = [],
  side = 'bottom-start',
  className = '',
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const away = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = e => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return /*#__PURE__*/React.createElement("div", _extends({
    ref: ref,
    className: ['op-menu-wrap', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("span", {
    onClick: () => setOpen(o => !o)
  }, trigger), open && /*#__PURE__*/React.createElement("div", {
    className: "op-menu",
    "data-side": side,
    role: "menu"
  }, items.map((it, i) => {
    if (it.type === 'separator') return /*#__PURE__*/React.createElement("div", {
      key: `s${i}`,
      className: "op-menu__sep"
    });
    if (it.type === 'label') return /*#__PURE__*/React.createElement("div", {
      key: `l${i}`,
      className: "op-menu__label"
    }, it.label);
    return /*#__PURE__*/React.createElement("button", {
      key: it.label + i,
      type: "button",
      role: "menuitem",
      className: "op-menu__item",
      "data-variant": it.variant || 'default',
      "data-disabled": it.disabled ? 'true' : 'false',
      onClick: () => {
        setOpen(false);
        it.onSelect && it.onSelect();
      }
    }, it.icon && /*#__PURE__*/React.createElement("span", {
      className: "op-menu__icon"
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: it.icon,
      size: 15
    })), /*#__PURE__*/React.createElement("span", {
      className: "op-menu__label-text"
    }, it.label), it.shortcut && /*#__PURE__*/React.createElement("span", {
      className: "op-menu__shortcut"
    }, it.shortcut));
  })));
}
Object.assign(__ds_scope, { DropdownMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/DropdownMenu.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Names an icon-only control. Never holds information you need to complete a task. */
function Tooltip({
  label,
  side = 'top',
  children,
  className = '',
  ...rest
}) {
  const [show, setShow] = React.useState(false);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ['op-tip-wrap', className].filter(Boolean).join(' '),
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false)
  }, rest), children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    className: "op-tip",
    "data-side": side
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/terminal/SessionItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** One session in the sidebar. A single 30px line — there are hundreds. */
function SessionItem({
  name,
  state = 'idle',
  age,
  active = false,
  as = 'button',
  className = '',
  ...rest
}) {
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: ['op-session', className].filter(Boolean).join(' '),
    type: Tag === 'button' ? 'button' : undefined,
    "data-active": active ? 'true' : undefined,
    "data-state": state
  }, rest), /*#__PURE__*/React.createElement("svg", {
    className: "op-session__glyph",
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M15 6a9 9 0 0 0-9 9V3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "6",
    r: "3"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "6",
    cy: "18",
    r: "3"
  })), /*#__PURE__*/React.createElement("span", {
    className: "op-session__name"
  }, name), age && /*#__PURE__*/React.createElement("span", {
    className: "op-session__age"
  }, age));
}
Object.assign(__ds_scope, { SessionItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/SessionItem.jsx", error: String((e && e.message) || e) }); }

// components/terminal/Terminal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The console surface. Oppenheimer orchestrates terminal sessions, so this is
 *  the product's main view — give it the full pane, not a card. */
function Terminal({
  lines = [],
  prompt = true,
  promptPlaceholder = 'Type a command…',
  value,
  onChange,
  status,
  autoScroll = true,
  className = '',
  ...rest
}) {
  const scrollRef = React.useRef(null);
  React.useEffect(() => {
    if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lines, autoScroll]);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-term', className].filter(Boolean).join(' ')
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "op-term__scroll",
    ref: scrollRef
  }, lines.map((l, i) => /*#__PURE__*/React.createElement(TerminalLine, _extends({
    key: i
  }, typeof l === 'string' ? {
    text: l
  } : l)))), prompt && /*#__PURE__*/React.createElement("div", {
    className: "op-term__prompt"
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-term__chev"
  }, "\u276F"), /*#__PURE__*/React.createElement("input", {
    className: "op-term__input",
    placeholder: promptPlaceholder,
    value: value,
    onChange: onChange
  })), status && /*#__PURE__*/React.createElement("div", {
    className: "op-term__status"
  }, status.map((s, i) => /*#__PURE__*/React.createElement("span", {
    className: "op-term__statusitem",
    key: i
  }, s))));
}

/** One scrollback row. `kind` picks the shape, `tone` picks the colour. */
function TerminalLine({
  text = '',
  kind = 'out',
  tone,
  children
}) {
  if (kind === 'spacer') return /*#__PURE__*/React.createElement("div", {
    className: "op-term__spacer"
  });
  if (kind === 'cmd') return /*#__PURE__*/React.createElement("div", {
    className: "op-term__line op-term__cmd"
  }, children ?? text);
  if (kind === 'turn') {
    return /*#__PURE__*/React.createElement("div", {
      className: "op-term__turn"
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-term__turnbody"
    }, /*#__PURE__*/React.createElement("div", {
      className: "op-term__line",
      "data-tone": tone
    }, children ?? text)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "op-term__line",
    "data-tone": tone
  }, children ?? text);
}
Object.assign(__ds_scope, { Terminal, TerminalLine });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/Terminal.jsx", error: String((e && e.message) || e) }); }

// components/terminal/TerminalTabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The session tab strip above the terminal. One tab per live session. */
function TerminalTabs({
  tabs = [],
  activeId,
  onSelect,
  onClose,
  onNew,
  className = '',
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ['op-term-tabs', className].filter(Boolean).join(' '),
    role: "tablist"
  }, rest), tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.id,
    className: "op-term-tab",
    type: "button",
    role: "tab",
    "data-active": t.id === activeId ? 'true' : undefined,
    "aria-selected": t.id === activeId,
    onClick: () => onSelect && onSelect(t.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "op-term-tab__dot",
    "data-state": t.state
  }), /*#__PURE__*/React.createElement("span", {
    className: "op-term-tab__label"
  }, t.label), onClose && /*#__PURE__*/React.createElement("span", {
    className: "op-term-tab__close",
    role: "button",
    "aria-label": `Close ${t.label}`,
    onClick: e => {
      e.stopPropagation();
      onClose(t.id);
    }
  }, "\xD7"))), onNew && /*#__PURE__*/React.createElement("button", {
    className: "op-term-tabs__new",
    type: "button",
    "aria-label": "New session",
    onClick: onNew
  }, "+"));
}
Object.assign(__ds_scope, { TerminalTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/terminal/TerminalTabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/AppShell.jsx
try { (() => {
/* Oppenheimer Console — application shell: navigation rail + top bar. */
/* scoped */(() => {
  const {
    Sidebar,
    SidebarHeader,
    SidebarScroll,
    SidebarFooter,
    SidebarSection,
    SidebarItem,
    Wordmark,
    IconButton,
    Input,
    Kbd,
    Avatar,
    DropdownMenu,
    ThemeToggle,
    Button,
    Tooltip,
    Icon
  } = window.OppenheimerDesignSystem_9a2556;
  const WORKSPACES = [{
    name: 'Atlas Prod',
    runs: [{
      id: 'nightly-ingest',
      label: 'nightly-ingest',
      tone: 'var(--success)',
      meta: '2m'
    }, {
      id: 'invoice-triage',
      label: 'invoice-triage',
      tone: 'var(--warning)',
      meta: '18m'
    }, {
      id: 'doc-summariser',
      label: 'doc-summariser',
      tone: 'var(--fg-subtle)',
      meta: '1d',
      muted: true
    }]
  }, {
    name: 'Sandbox',
    runs: [{
      id: 'retriever-eval',
      label: 'retriever-eval',
      tone: 'var(--danger)',
      meta: '4h'
    }, {
      id: 'tool-router',
      label: 'tool-router',
      tone: 'var(--fg-subtle)',
      meta: '3d',
      muted: true
    }]
  }];
  function ConsoleSidebar({
    view,
    onNavigate,
    activeRun
  }) {
    return /*#__PURE__*/React.createElement(Sidebar, null, /*#__PURE__*/React.createElement(SidebarHeader, null, /*#__PURE__*/React.createElement(Wordmark, {
      size: 18,
      product: "Console"
    }), /*#__PURE__*/React.createElement(IconButton, {
      icon: "panel-left",
      label: "Collapse sidebar",
      size: "sm"
    })), /*#__PURE__*/React.createElement(SidebarScroll, null, /*#__PURE__*/React.createElement(SidebarSection, null, /*#__PURE__*/React.createElement(SidebarItem, {
      icon: "plus",
      label: "New run",
      onClick: () => onNavigate('overview')
    }), /*#__PURE__*/React.createElement(SidebarItem, {
      icon: "workflow",
      label: "Pipelines",
      active: view === 'overview',
      onClick: () => onNavigate('overview')
    }), /*#__PURE__*/React.createElement(SidebarItem, {
      icon: "bot",
      label: "Agents",
      meta: "12"
    }), /*#__PURE__*/React.createElement(SidebarItem, {
      icon: "boxes",
      label: "Tools",
      meta: "41"
    }), /*#__PURE__*/React.createElement(SidebarItem, {
      icon: "activity",
      label: "Observability"
    })), WORKSPACES.map(ws => /*#__PURE__*/React.createElement(SidebarSection, {
      key: ws.name,
      title: ws.name,
      action: /*#__PURE__*/React.createElement(IconButton, {
        icon: "plus",
        label: `New run in ${ws.name}`,
        size: "sm"
      })
    }, ws.runs.map(r => /*#__PURE__*/React.createElement(SidebarItem, {
      key: r.id,
      dotColor: r.tone,
      label: r.label,
      meta: r.meta,
      muted: r.muted,
      active: view === 'run' && activeRun === r.id,
      onClick: () => onNavigate('run', r.id)
    }))))), /*#__PURE__*/React.createElement(SidebarFooter, null, /*#__PURE__*/React.createElement(DropdownMenu, {
      side: "top-start",
      trigger: /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '4px 6px',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer'
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        name: "Jordi Parra",
        size: "md",
        accent: true
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1,
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, "Jordi Parra"), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 11,
          color: 'var(--sidebar-muted)'
        }
      }, "Atlas \xB7 Owner")), /*#__PURE__*/React.createElement(Icon, {
        name: "chevron-up",
        size: 14
      })),
      items: [{
        type: 'label',
        label: 'jordi@atlas.co'
      }, {
        label: 'Workspace settings',
        icon: 'settings'
      }, {
        label: 'API keys',
        icon: 'key'
      }, {
        label: 'Members',
        icon: 'users',
        shortcut: '⌘M'
      }, {
        type: 'separator'
      }, {
        label: 'Sign out',
        icon: 'log-out',
        variant: 'danger'
      }]
    })));
  }
  function TopBar({
    title,
    breadcrumb,
    actions,
    theme,
    onTheme
  }) {
    return /*#__PURE__*/React.createElement("header", {
      style: {
        height: 'var(--topbar-h)',
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 24px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--background)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, breadcrumb && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'var(--fg-subtle)'
      }
    }, breadcrumb.map((b, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: b
    }, i > 0 && /*#__PURE__*/React.createElement(Icon, {
      name: "chevron-right",
      size: 11
    }), /*#__PURE__*/React.createElement("span", null, b)))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 600,
        letterSpacing: '-0.008em',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, title)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 260,
        maxWidth: '28vw'
      }
    }, /*#__PURE__*/React.createElement(Input, {
      pill: true,
      size: "sm",
      iconLeft: "search",
      placeholder: "Search runs, agents, tools",
      trailing: /*#__PURE__*/React.createElement(Kbd, null, "\u2318K")
    })), actions, /*#__PURE__*/React.createElement(Tooltip, {
      label: "Notifications",
      side: "bottom"
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: "bell",
      label: "Notifications"
    })), /*#__PURE__*/React.createElement(ThemeToggle, {
      theme: theme,
      onChange: onTheme,
      target: document.documentElement
    }));
  }
  function AppShell({
    view,
    activeRun,
    onNavigate,
    theme,
    onTheme,
    title,
    breadcrumb,
    actions,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: '100vh',
        background: 'var(--background)',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement(ConsoleSidebar, {
      view: view,
      activeRun: activeRun,
      onNavigate: onNavigate
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, /*#__PURE__*/React.createElement(TopBar, {
      title: title,
      breadcrumb: breadcrumb,
      actions: actions,
      theme: theme,
      onTheme: onTheme
    }), /*#__PURE__*/React.createElement("main", {
      style: {
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        background: 'var(--canvas)'
      }
    }, children)));
  }
  Object.assign(window, {
    AppShell,
    ConsoleSidebar,
    TopBar,
    WORKSPACES
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/AuthScreens.jsx
try { (() => {
/* Oppenheimer Console — authentication surfaces.
   Split layout: form column on the canvas, statement panel on ink.
   No photography ships with this system; the panel is tonal, not illustrated. */
/* scoped */(() => {
  const {
    Button,
    Input,
    Field,
    Wordmark,
    Icon,
    Separator,
    Checkbox
  } = window.OppenheimerDesignSystem_9a2556;

  /* The statement panel is inset, not full-bleed: a portrait card centred in its
     column with air above and below, so the page reads as two floating objects. */
  const authPanelWrapStyle = {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };
  const authPanelStyle = {
    display: 'block',
    width: '100%',
    maxWidth: 470,
    aspectRatio: '4 / 5',
    maxHeight: '82vh',
    objectFit: 'cover',
    objectPosition: '44% center',
    background: 'var(--op-gray-900)',
    borderRadius: 20
  };
  const authColStyle = {
    flex: '1 1 0',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px 24px'
  };
  const authFormStyle = {
    width: '100%',
    maxWidth: 340,
    display: 'flex',
    flexDirection: 'column',
    gap: 20
  };
  function AuthPanel() {
    return /*#__PURE__*/React.createElement("div", {
      style: authPanelWrapStyle
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/imagery/auth-workstation.png",
      alt: "",
      style: authPanelStyle
    }));
  }
  function SignIn({
    onContinue,
    onSSO
  }) {
    const [email, setEmail] = React.useState('');
    return /*#__PURE__*/React.createElement("div", {
      style: authColStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: authFormStyle
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 38,
        fontWeight: 600,
        letterSpacing: '-0.024em',
        lineHeight: 1.1
      }
    }, "Simple but powerful"), /*#__PURE__*/React.createElement("p", {
      style: {
        marginTop: 8,
        fontSize: 15,
        color: 'var(--fg-muted)'
      }
    }, "Sign in to reach your workspaces.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "social",
      size: "lg",
      block: true,
      onClick: onSSO
    }, /*#__PURE__*/React.createElement("img", {
      className: "op-btn__glyph op-btn__glyph--color",
      src: "../../assets/brand/google-color.svg",
      alt: ""
    }), "Continue with Google"), /*#__PURE__*/React.createElement(Button, {
      variant: "social",
      size: "lg",
      block: true,
      onClick: onSSO
    }, /*#__PURE__*/React.createElement("img", {
      className: "op-btn__glyph",
      src: "../../assets/brand/github.svg",
      alt: ""
    }), "Continue with GitHub")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Separator, {
      style: {
        flex: 1,
        width: 'auto'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--fg-subtle)',
        letterSpacing: '.02em'
      }
    }, "OR"), /*#__PURE__*/React.createElement(Separator, {
      style: {
        flex: 1,
        width: 'auto'
      }
    })), /*#__PURE__*/React.createElement("form", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      },
      onSubmit: e => {
        e.preventDefault();
        if (onContinue) onContinue(email);
      }
    }, /*#__PURE__*/React.createElement(Field, {
      label: "Work email"
    }, /*#__PURE__*/React.createElement(Input, {
      size: "lg",
      type: "email",
      placeholder: "you@company.com",
      value: email,
      iconLeft: "mail",
      onChange: e => setEmail(e.target.value)
    })), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      type: "submit"
    }, "Continue with email")), /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 12,
        color: 'var(--fg-subtle)',
        lineHeight: 1.5
      }
    }, "By continuing you accept the ", /*#__PURE__*/React.createElement("a", {
      href: "#terms"
    }, "Terms"), " and ", /*#__PURE__*/React.createElement("a", {
      href: "#privacy"
    }, "Privacy Policy"), ".")));
  }
  function VerifyCode({
    email,
    onVerify,
    onBack
  }) {
    const [code, setCode] = React.useState(['', '', '', '', '', '']);
    const refs = React.useRef([]);
    const set = (i, v) => {
      if (!/^\d?$/.test(v)) return;
      const next = code.slice();
      next[i] = v;
      setCode(next);
      if (v && refs.current[i + 1]) refs.current[i + 1].focus();
    };
    const complete = code.every(Boolean);
    return /*#__PURE__*/React.createElement("div", {
      style: authColStyle
    }, /*#__PURE__*/React.createElement("div", {
      style: authFormStyle
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 38,
        fontWeight: 600,
        letterSpacing: '-0.024em',
        lineHeight: 1.1
      }
    }, "Check your inbox"), /*#__PURE__*/React.createElement("p", {
      style: {
        marginTop: 8,
        fontSize: 15,
        color: 'var(--fg-muted)'
      }
    }, "We sent a six-digit code to ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg)'
      }
    }, email || 'you@company.com'), ".")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8
      }
    }, code.map((c, i) => /*#__PURE__*/React.createElement("input", {
      key: i,
      ref: el => {
        refs.current[i] = el;
      },
      value: c,
      inputMode: "numeric",
      maxLength: 1,
      onChange: e => set(i, e.target.value),
      onKeyDown: e => {
        if (e.key === 'Backspace' && !c && refs.current[i - 1]) refs.current[i - 1].focus();
      },
      style: {
        width: 48,
        height: 56,
        textAlign: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 22,
        background: 'var(--field)',
        color: 'var(--fg)',
        border: `1px solid ${c ? 'var(--primary)' : 'var(--field-border)'}`,
        borderRadius: 'var(--radius-sm)',
        outline: 'none'
      }
    }))), /*#__PURE__*/React.createElement(Checkbox, {
      label: "Keep me signed in on this device",
      defaultChecked: true
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "lg",
      block: true,
      disabled: !complete,
      onClick: onVerify
    }, "Open console"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: onBack,
      style: {
        background: 'none',
        border: 0,
        padding: 0,
        color: 'var(--link)',
        fontSize: 13,
        cursor: 'pointer',
        alignSelf: 'flex-start'
      }
    }, "Use a different address")));
  }
  function AuthLayout({
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--canvas)',
        padding: '36px 40px',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(Wordmark, {
      size: 20,
      product: "Console",
      style: {
        position: 'absolute',
        top: 34,
        left: 44
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flex: 1,
        gap: 48,
        maxWidth: 1360,
        margin: '0 auto',
        alignItems: 'center'
      }
    }, children, /*#__PURE__*/React.createElement(AuthPanel, null)));
  }
  Object.assign(window, {
    AuthLayout,
    AuthPanel,
    SignIn,
    VerifyCode
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/AuthScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/Overview.jsx
try { (() => {
/* Oppenheimer Console — Pipelines overview (the default landing view). */
/* scoped */(() => {
  const {
    Card,
    CardHeader,
    CardBody,
    StatCard,
    Sparkline,
    AreaChart,
    BarChart,
    ChartLegend,
    DonutChart,
    Table,
    Badge,
    Button,
    IconButton,
    Chip,
    Tabs,
    Select,
    Combobox,
    DropdownMenu,
    ProgressBar,
    EmptyState
  } = window.OppenheimerDesignSystem_9a2556;
  const RUN_ROWS = [{
    id: 'r1',
    name: 'nightly-ingest',
    ws: 'Atlas Prod',
    state: 'Running',
    tone: 'success',
    agent: 'Ingestor',
    steps: '14 / 18',
    p95: '812',
    cost: '$2.41',
    when: '2m ago'
  }, {
    id: 'r2',
    name: 'invoice-triage',
    ws: 'Atlas Prod',
    state: 'Needs input',
    tone: 'warning',
    agent: 'Triage',
    steps: '6 / 9',
    p95: '344',
    cost: '$0.88',
    when: '18m ago'
  }, {
    id: 'r3',
    name: 'retriever-eval',
    ws: 'Sandbox',
    state: 'Failed',
    tone: 'danger',
    agent: 'Evaluator',
    steps: '3 / 11',
    p95: '1204',
    cost: '$0.12',
    when: '4h ago'
  }, {
    id: 'r4',
    name: 'doc-summariser',
    ws: 'Atlas Prod',
    state: 'Completed',
    tone: 'neutral',
    agent: 'Writer',
    steps: '9 / 9',
    p95: '502',
    cost: '$1.06',
    when: '1d ago'
  }, {
    id: 'r5',
    name: 'tool-router',
    ws: 'Sandbox',
    state: 'Completed',
    tone: 'neutral',
    agent: 'Router',
    steps: '4 / 4',
    p95: '210',
    cost: '$0.04',
    when: '3d ago'
  }];
  function Overview({
    onOpenRun
  }) {
    const [range, setRange] = React.useState('24h');
    const [ws, setWs] = React.useState('all');
    const [onlyFailed, setOnlyFailed] = React.useState(false);
    const rows = onlyFailed ? RUN_ROWS.filter(r => r.tone === 'danger') : RUN_ROWS;
    const columns = [{
      key: 'name',
      header: 'Run',
      render: r => /*#__PURE__*/React.createElement("button", {
        type: "button",
        onClick: () => onOpenRun(r.name),
        style: {
          background: 'none',
          border: 0,
          padding: 0,
          font: 'inherit',
          fontWeight: 500,
          color: 'var(--fg)',
          cursor: 'pointer'
        }
      }, r.name)
    }, {
      key: 'ws',
      header: 'Workspace',
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--fg-muted)'
        }
      }, r.ws)
    }, {
      key: 'state',
      header: 'State',
      render: r => /*#__PURE__*/React.createElement(Badge, {
        tone: r.tone,
        dot: r.tone !== 'neutral'
      }, r.state)
    }, {
      key: 'agent',
      header: 'Lead agent',
      render: r => /*#__PURE__*/React.createElement(Chip, {
        variant: "solid",
        dotColor: "var(--chart-3)"
      }, r.agent)
    }, {
      key: 'steps',
      header: 'Steps',
      align: 'right',
      numeric: true
    }, {
      key: 'p95',
      header: 'p95 ms',
      align: 'right',
      numeric: true
    }, {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      numeric: true
    }, {
      key: 'when',
      header: 'Updated',
      align: 'right',
      render: r => /*#__PURE__*/React.createElement("span", {
        style: {
          color: 'var(--fg-subtle)',
          fontSize: 13
        }
      }, r.when)
    }, {
      key: 'act',
      header: '',
      align: 'right',
      width: 44,
      render: () => /*#__PURE__*/React.createElement(DropdownMenu, {
        side: "bottom-end",
        trigger: /*#__PURE__*/React.createElement(IconButton, {
          icon: "ellipsis",
          label: "Run actions",
          size: "sm"
        }),
        items: [{
          label: 'Open run',
          icon: 'external-link'
        }, {
          label: 'Re-queue',
          icon: 'refresh'
        }, {
          label: 'Duplicate',
          icon: 'copy'
        }, {
          type: 'separator'
        }, {
          label: 'Pause schedule',
          icon: 'pause'
        }, {
          label: 'Delete',
          icon: 'x',
          variant: 'danger'
        }]
      })
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 1400
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      value: range,
      onChange: setRange,
      tabs: [{
        value: '24h',
        label: '24 hours'
      }, {
        value: '7d',
        label: '7 days'
      }, {
        value: '30d',
        label: '30 days'
      }]
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 190
      }
    }, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      value: ws,
      onChange: setWs,
      options: [{
        value: 'all',
        label: 'All workspaces'
      }, {
        value: 'prod',
        label: 'Atlas Prod'
      }, {
        value: 'sbx',
        label: 'Sandbox'
      }]
    })), /*#__PURE__*/React.createElement(Chip, {
      icon: "alert-triangle",
      selected: onlyFailed,
      onClick: () => setOnlyFailed(v => !v)
    }, "Failures only"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: "download"
    }, "Export"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      size: "sm",
      iconLeft: "plus"
    }, "New run")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(StatCard, {
      label: "Runs completed",
      icon: "workflow",
      value: "1,284",
      delta: "12.4%",
      direction: "up",
      spark: /*#__PURE__*/React.createElement(Sparkline, {
        data: [8, 12, 10, 16, 14, 22, 19, 26]
      })
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Success rate",
      icon: "check-circle",
      value: "98.2",
      unit: "%",
      delta: "0.4%",
      direction: "up"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "p95 step latency",
      icon: "clock",
      value: "812",
      unit: "ms",
      delta: "6.1%",
      direction: "down"
    }), /*#__PURE__*/React.createElement(StatCard, {
      label: "Spend",
      icon: "zap",
      value: "$412",
      delta: "on budget",
      direction: "flat",
      caption: "of $1,000"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Throughput",
      description: "Runs per hour",
      action: /*#__PURE__*/React.createElement(ChartLegend, {
        items: [{
          label: 'Completed'
        }, {
          label: 'Failed',
          color: 'var(--chart-5)'
        }]
      })
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement(AreaChart, {
      height: 196,
      labels: ['09', '10', '11', '12', '13', '14', '15', '16', '17', '18'],
      series: [{
        name: 'Completed',
        data: [42, 55, 48, 72, 68, 90, 84, 112, 104, 96]
      }, {
        name: 'Failed',
        data: [4, 3, 6, 2, 5, 3, 7, 4, 2, 3],
        color: 'var(--chart-5)'
      }]
    }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Step mix",
      description: "Where time is spent"
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement(DonutChart, {
      size: 168,
      thickness: 15,
      centerValue: "4.2k",
      centerCaption: "steps this period",
      data: [{
        label: 'Tool calls',
        value: 52
      }, {
        label: 'Model',
        value: 28
      }, {
        label: 'Human review',
        value: 12
      }, {
        label: 'Retries',
        value: 8
      }]
    }), /*#__PURE__*/React.createElement(ChartLegend, {
      items: [{
        label: 'Tool calls',
        value: '52%'
      }, {
        label: 'Model',
        value: '28%'
      }, {
        label: 'Human review',
        value: '12%'
      }, {
        label: 'Retries',
        value: '8%'
      }]
    })))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.7fr)',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Cost by agent",
      description: "Last 24 hours"
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 8
      }
    }, /*#__PURE__*/React.createElement(BarChart, {
      height: 184,
      labels: ['Plan', 'Search', 'Write', 'Review', 'Route'],
      series: [{
        name: 'USD',
        data: [112, 208, 164, 86, 41]
      }],
      yFormat: v => `$${v}`
    }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Quotas",
      description: "Resets in 12 days"
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, [{
      label: 'Orchestration minutes',
      used: '6,420',
      of: '10,000',
      pct: 64,
      color: undefined
    }, {
      label: 'Tool invocations',
      used: '38,110',
      of: '50,000',
      pct: 76,
      color: undefined
    }, {
      label: 'Human review seats',
      used: '11',
      of: '12',
      pct: 92,
      color: 'var(--warning)'
    }, {
      label: 'Vector storage',
      used: '184 GB',
      of: '500 GB',
      pct: 37,
      color: undefined
    }].map(q => /*#__PURE__*/React.createElement("div", {
      key: q.label,
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 7
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", null, q.label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        color: 'var(--fg-muted)',
        fontSize: 12
      }
    }, q.used, " / ", q.of)), /*#__PURE__*/React.createElement(ProgressBar, {
      value: q.pct,
      color: q.color,
      size: "sm"
    })))))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Recent runs",
      description: `${rows.length} of ${RUN_ROWS.length} shown`,
      action: /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "sm",
        iconRight: "arrow-right"
      }, "View all")
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        padding: '12px 0 0'
      }
    }, rows.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
      icon: "check-circle",
      title: "No failures",
      description: "Every run in this window completed."
    }) : /*#__PURE__*/React.createElement(Table, {
      columns: columns,
      rows: rows
    }))));
  }
  Object.assign(window, {
    Overview,
    RUN_ROWS
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/Overview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/console/RunDetail.jsx
try { (() => {
/* Oppenheimer Console — single run detail: step timeline, inputs, live output. */
/* scoped */(() => {
  const {
    Card,
    CardHeader,
    CardBody,
    CardFooter,
    Badge,
    Button,
    IconButton,
    Chip,
    Tabs,
    Icon,
    Table,
    AreaChart,
    Separator,
    Switch,
    Field,
    Select,
    Combobox,
    Dialog,
    ProgressBar,
    Avatar,
    Tooltip
  } = window.OppenheimerDesignSystem_9a2556;
  const STEPS = [{
    id: 1,
    name: 'Fetch source manifest',
    agent: 'Ingestor',
    tool: 'http.get',
    state: 'done',
    ms: 312,
    tokens: '1.2k'
  }, {
    id: 2,
    name: 'Chunk and embed',
    agent: 'Ingestor',
    tool: 'embed.batch',
    state: 'done',
    ms: 4820,
    tokens: '84k'
  }, {
    id: 3,
    name: 'Deduplicate against index',
    agent: 'Ingestor',
    tool: 'vector.query',
    state: 'done',
    ms: 641,
    tokens: '—'
  }, {
    id: 4,
    name: 'Classify unmatched records',
    agent: 'Planner',
    tool: 'model.call',
    state: 'running',
    ms: 1180,
    tokens: '22k'
  }, {
    id: 5,
    name: 'Write to warehouse',
    agent: 'Executor',
    tool: 'sql.write',
    state: 'queued',
    ms: null,
    tokens: '—'
  }, {
    id: 6,
    name: 'Notify owners',
    agent: 'Executor',
    tool: 'slack.post',
    state: 'queued',
    ms: null,
    tokens: '—'
  }];
  const STEP_TONE = {
    done: 'neutral',
    running: 'success',
    queued: 'outline',
    failed: 'danger'
  };
  const STEP_ICON = {
    done: 'check-circle',
    running: 'loader',
    queued: 'clock',
    failed: 'alert-circle'
  };
  function StepRow({
    step,
    active,
    onSelect
  }) {
    return /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: () => onSelect(step),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 24px',
        border: 0,
        background: active ? 'var(--hover-surface)' : 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
        borderBottom: '1px solid var(--border-subtle)',
        font: 'inherit'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: step.state === 'running' ? 'var(--success)' : 'var(--fg-subtle)',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: STEP_ICON[step.state],
      size: 15,
      spin: step.state === 'running'
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 26,
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--fg-subtle)'
      }
    }, String(step.id).padStart(2, '0')), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1,
        minWidth: 0,
        fontSize: 14,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, step.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--fg-subtle)'
      }
    }, step.tool), /*#__PURE__*/React.createElement(Chip, {
      variant: "solid",
      dotColor: "var(--chart-3)",
      style: {
        pointerEvents: 'none'
      }
    }, step.agent), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 64,
        textAlign: 'right',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--fg-muted)'
      }
    }, step.ms == null ? '—' : `${step.ms}ms`));
  }
  function RunDetail({
    runName = 'nightly-ingest',
    onBack
  }) {
    const [tab, setTab] = React.useState('steps');
    const [selected, setSelected] = React.useState(STEPS[3]);
    const [stopOpen, setStopOpen] = React.useState(false);
    const [stream, setStream] = React.useState(true);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        maxWidth: 1400
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Running"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--fg-subtle)'
      }
    }, "run_8f2a91c4"), /*#__PURE__*/React.createElement(Separator, {
      orientation: "vertical"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-muted)'
      }
    }, "Started 2m ago \xB7 trigger schedule \xB7 4 of 6 steps"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Switch, {
      size: "sm",
      label: "Stream steps",
      checked: stream,
      onChange: () => setStream(v => !v)
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "outline",
      size: "sm",
      iconLeft: "refresh"
    }, "Re-queue"), /*#__PURE__*/React.createElement(Button, {
      variant: "danger",
      size: "sm",
      iconLeft: "pause",
      onClick: () => setStopOpen(true)
    }, "Stop run")), /*#__PURE__*/React.createElement(Card, {
      padded: true
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-muted)'
      }
    }, "Progress"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 13
      }
    }, "67%"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--fg-subtle)'
      }
    }, "ETA 1m 40s")), /*#__PURE__*/React.createElement(ProgressBar, {
      value: 67
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)',
        gap: 12,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: runName,
      description: "Pipeline \xB7 Atlas Prod",
      action: /*#__PURE__*/React.createElement(Tabs, {
        value: tab,
        onChange: setTab,
        tabs: [{
          value: 'steps',
          label: 'Steps'
        }, {
          value: 'logs',
          label: 'Logs'
        }]
      })
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        padding: '12px 0 0'
      }
    }, tab === 'steps' ? /*#__PURE__*/React.createElement("div", null, STEPS.map(s => /*#__PURE__*/React.createElement(StepRow, {
      key: s.id,
      step: s,
      active: selected && selected.id === s.id,
      onSelect: setSelected
    }))) : /*#__PURE__*/React.createElement("pre", {
      style: {
        margin: 0,
        padding: '0 24px 20px',
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5,
        lineHeight: 1.8,
        color: 'var(--fg-muted)',
        whiteSpace: 'pre-wrap'
      }
    }, `14:02:11  orchestrator  run_8f2a91c4 accepted (trigger=schedule)
14:02:11  ingestor      http.get https://atlas.co/manifest.json → 200 (312ms)
14:02:12  ingestor      embed.batch 1,842 chunks → ok (4.82s)
14:02:17  ingestor      vector.query dedupe → 96 unmatched
14:02:18  planner       model.call tier=balanced temp=0.2
14:02:19  planner       classifying 96 records …`)), /*#__PURE__*/React.createElement(CardFooter, null, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: 'var(--fg-subtle)'
      }
    }, "Retries exhausted: 0 of 3"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: "download"
    }, "Download trace"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Step detail",
      description: selected ? selected.name : 'Select a step'
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, [['Agent', selected && selected.agent], ['Tool', selected && selected.tool], ['Duration', selected && (selected.ms == null ? 'queued' : `${selected.ms} ms`)], ['Tokens', selected && selected.tokens], ['Attempt', '1 of 3']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
      key: k,
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fg-muted)'
      }
    }, k), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: 'var(--font-mono)',
        fontSize: 12.5
      }
    }, v))), /*#__PURE__*/React.createElement(Separator, null), /*#__PURE__*/React.createElement(Field, {
      label: "Re-run this step with"
    }, /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      value: "balanced",
      options: [{
        value: 'fast',
        label: 'Orchestrator · fast'
      }, {
        value: 'balanced',
        label: 'Orchestrator · balanced'
      }, {
        value: 'deep',
        label: 'Orchestrator · deep'
      }]
    })), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      block: true,
      iconLeft: "play"
    }, "Re-run step"))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Latency",
      description: "Per step, milliseconds"
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 6
      }
    }, /*#__PURE__*/React.createElement(AreaChart, {
      height: 120,
      labels: ['01', '02', '03', '04', '05', '06'],
      series: [{
        name: 'ms',
        data: [312, 4820, 641, 1180, 0, 0]
      }],
      yFormat: v => v >= 1000 ? `${Math.round(v / 1000)}k` : v
    }))), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(CardHeader, {
      title: "Watchers"
    }), /*#__PURE__*/React.createElement(CardBody, {
      style: {
        paddingTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: "Jordi Parra",
      accent: true
    }), /*#__PURE__*/React.createElement(Avatar, {
      name: "Ada Lovelace"
    }), /*#__PURE__*/React.createElement(Avatar, {
      name: "Mei Chen"
    }), /*#__PURE__*/React.createElement(Tooltip, {
      label: "Add watcher"
    }, /*#__PURE__*/React.createElement(IconButton, {
      icon: "plus",
      label: "Add watcher",
      variant: "outline"
    })))))), /*#__PURE__*/React.createElement(Dialog, {
      open: stopOpen,
      onClose: () => setStopOpen(false),
      title: "Stop this run?",
      description: "Two steps are mid-flight. Completed work is kept; in-flight tool calls are cancelled.",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        onClick: () => setStopOpen(false)
      }, "Keep running"), /*#__PURE__*/React.createElement(Button, {
        variant: "danger",
        onClick: () => setStopOpen(false)
      }, "Stop run"))
    }));
  }
  Object.assign(window, {
    RunDetail,
    STEPS
  });
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/console/RunDetail.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.CardHeader = __ds_scope.CardHeader;

__ds_ns.CardBody = __ds_scope.CardBody;

__ds_ns.CardFooter = __ds_scope.CardFooter;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.ICONS = __ds_scope.ICONS;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Kbd = __ds_scope.Kbd;

__ds_ns.Separator = __ds_scope.Separator;

__ds_ns.Wordmark = __ds_scope.Wordmark;

__ds_ns.AreaChart = __ds_scope.AreaChart;

__ds_ns.Sparkline = __ds_scope.Sparkline;

__ds_ns.BarChart = __ds_scope.BarChart;

__ds_ns.ChartLegend = __ds_scope.ChartLegend;

__ds_ns.DonutChart = __ds_scope.DonutChart;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ProgressBar = __ds_scope.ProgressBar;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Combobox = __ds_scope.Combobox;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.SidebarHeader = __ds_scope.SidebarHeader;

__ds_ns.SidebarScroll = __ds_scope.SidebarScroll;

__ds_ns.SidebarFooter = __ds_scope.SidebarFooter;

__ds_ns.SidebarSection = __ds_scope.SidebarSection;

__ds_ns.SidebarItem = __ds_scope.SidebarItem;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.ThemeToggle = __ds_scope.ThemeToggle;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.DropdownMenu = __ds_scope.DropdownMenu;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.SessionItem = __ds_scope.SessionItem;

__ds_ns.Terminal = __ds_scope.Terminal;

__ds_ns.TerminalLine = __ds_scope.TerminalLine;

__ds_ns.TerminalTabs = __ds_scope.TerminalTabs;

})();
