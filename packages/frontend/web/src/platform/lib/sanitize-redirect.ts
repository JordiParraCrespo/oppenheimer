/**
 * Accepts only a path on this origin.
 *
 * The value arrives in the URL, so anyone can set it. A protocol-relative
 * (`//evil.example`) or absolute value would send someone who just signed in,
 * or merely opened the link while signed in, to a lookalike login screen. So
 * anything but a single-slash path is dropped, not sanitised; a same-origin
 * path keeps its search string.
 *
 * Shared by the login route and the `_auth` layout: two different checks is
 * how an open redirect gets in.
 */
export function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  // A backslash is treated as a slash by browsers when resolving URLs, so
  // `/\evil.example` would also leave the origin.
  if (value.startsWith('/\\')) return undefined;
  return value;
}
