/**
 * Accepts only a path on this origin.
 *
 * The value arrives in the URL, so anyone can put anything in it. A
 * protocol-relative (`//evil.example`) or absolute (`https://evil.example`)
 * value would send someone who just typed their password — or who is already
 * signed in and merely opened the link — to another site that looks like a
 * login screen. So anything that is not a single-slash path is dropped rather
 * than sanitised; a same-origin path keeps its search string.
 *
 * Shared by the login route (where the reader signs in and is sent on) and the
 * `_auth` layout (where an already-authenticated reader is sent on at once):
 * the two used to check different things, which is exactly how an open
 * redirect gets in.
 */
export function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (!value.startsWith('/') || value.startsWith('//')) return undefined;
  // A backslash is treated as a slash by browsers when resolving URLs, so
  // `/\evil.example` would also leave the origin.
  if (value.startsWith('/\\')) return undefined;
  return value;
}
