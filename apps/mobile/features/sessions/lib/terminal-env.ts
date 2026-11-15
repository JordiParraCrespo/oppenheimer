/**
 * `@xterm/headless` reads `navigator.userAgent` and `navigator.platform` when
 * it loads, outside Node, and React Native's `navigator` has neither. Each is
 * given an empty string where it is missing, so xterm sees no browser quirk
 * to work around, and any library that checks whether one is defined still
 * sees React Native. Imported before xterm, by the module that imports it.
 */
const host = globalThis.navigator as { userAgent?: string; platform?: string } | undefined;
if (host) {
  if (typeof host.userAgent !== 'string') {
    Object.defineProperty(host, 'userAgent', { value: '', configurable: true });
  }
  if (typeof host.platform !== 'string') {
    Object.defineProperty(host, 'platform', { value: '', configurable: true });
  }
}
