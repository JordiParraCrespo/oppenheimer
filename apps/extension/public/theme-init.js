// Before first paint, so a dark system never flashes the light theme. A file,
// not an inline script: the extension's CSP admits no inline script.
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}
