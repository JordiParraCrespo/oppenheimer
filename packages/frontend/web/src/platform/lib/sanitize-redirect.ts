import { isSameOriginPath } from '@oppenheimer/shared/urls';

/**
 * Accepts only a path on this origin.
 *
 * The value arrives in the URL, so anyone can set it. A protocol-relative
 * (`//evil.example`) or absolute value would send someone who just signed in,
 * or merely opened the link while signed in, to a lookalike login screen. So
 * anything `isSameOriginPath` refuses is dropped, not sanitised; a same-origin
 * path keeps its search string.
 *
 * Shared by the login search schema and `redirectSignedIn`: two different
 * checks is how an open redirect gets in.
 */
export function sanitizeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !isSameOriginPath(value)) return undefined;
  return value;
}
