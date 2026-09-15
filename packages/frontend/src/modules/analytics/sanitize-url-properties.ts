/** Matches absolute http(s) URLs, the only values worth rewriting. */
const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Removes query strings and fragments from any URL-valued property.
 *
 * Analytics providers attach the current location to events automatically —
 * PostHog sends `$current_url`, `$referrer` and their `$initial_` variants on
 * *every* event, including autocapture ones the app never raises itself. Routes
 * that carry a secret in the query string (`/reset-password?token=…`) would
 * otherwise leak it to a third party no matter how carefully the app's own
 * `pageView()` calls are constructed.
 *
 * This is provider-independent, so it lives here rather than in one adapter.
 * Hook it into whatever "before send" facility the provider offers.
 *
 * Campaign attribution is unaffected in practice: providers parse UTM
 * parameters into their own properties before the send hook runs. A value that
 * looks like a URL but can't be parsed is dropped rather than forwarded
 * unexamined.
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
