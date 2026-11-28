/**
 * Whether a value from a URL is a path on the origin that reads it, and so
 * cannot send a browser anywhere else.
 *
 * It must start with a single `/`: `//evil.example` is protocol-relative and
 * `https:…` absolute. It holds no backslash, which a browser resolves as a
 * slash (`/\evil.example`), and no C0 control character or DEL, which a
 * browser strips (`/\t/evil.example` reads `//evil.example`). Each caller
 * decides what a refused value becomes; this only says which values those are.
 */
export function isSameOriginPath(value: string): boolean {
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  return !CONTROL.test(value);
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are what it refuses
const CONTROL = /[\u0000-\u001f\u007f]/;
