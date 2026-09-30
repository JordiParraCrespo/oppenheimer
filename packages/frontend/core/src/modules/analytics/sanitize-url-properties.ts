/** Matches absolute http(s) URLs, the only values worth rewriting. */
const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Removes query strings and fragments from any URL-valued property.
 *
 * PostHog attaches `$current_url`, `$referrer` and their `$initial_` variants
 * to *every* event, autocapture included, so a route carrying a secret in its
 * query string (`/reset-password?token=…`) would leak it to a third party
 * however the app's own `pageView()` calls are built. Provider-independent:
 * hook it into whatever "before send" facility the provider offers.
 *
 * UTM attribution survives: providers parse it into their own properties
 * before the send hook runs. A URL-like value that cannot be parsed is dropped.
 */
export function sanitizeUrlProperties<T extends Record<string, unknown>>(properties: T): T {
  const sanitized: Record<string, unknown> = { ...properties };

  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value !== 'string' || !ABSOLUTE_URL.test(value)) continue;

    try {
      const url = new URL(value);
      url.search = '';
      url.hash = '';
      sanitized[key] = url.toString();
    } catch {
      sanitized[key] = null;
    }
  }

  return sanitized as T;
}
