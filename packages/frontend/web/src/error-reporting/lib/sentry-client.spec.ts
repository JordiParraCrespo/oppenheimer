import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubBrowserEvent } from './sentry-client';

// Regression: a reset link's token, a cookie or a console line (which can
// hold anything the app logged) reaching the error tracker.
describe('the console’s Sentry scrubbing', () => {
  it('keeps a request’s path and drops its query, fragment, cookies and headers', () => {
    const event = scrubBrowserEvent({
      request: {
        url: 'https://app.test/reset-password?token=secret#top',
        headers: { Cookie: 'better-auth.session_token=x' },
        cookies: { session: 'x' },
        query_string: 'token=secret',
      },
      user: { id: 'u1', email: 'a@b.c' } as { id: string },
    });
    expect(event.request).toEqual({ url: 'https://app.test/reset-password' });
    expect(event.user).toEqual({ id: 'u1' });
  });

  it('drops console breadcrumbs and the query of a navigation or a fetch', () => {
    expect(scrubBreadcrumb({ category: 'console', data: { arguments: ['token'] } })).toBeNull();
    expect(
      scrubBreadcrumb({
        category: 'navigation',
        data: { from: '/login?redirect=/x', to: '/reset-password?token=t' },
      }),
    ).toEqual({ category: 'navigation', data: { from: '/login', to: '/reset-password' } });
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        data: { url: '/api/v1/hosts?code=1', status_code: 500 },
      }),
    ).toEqual({ category: 'fetch', data: { url: '/api/v1/hosts', status_code: 500 } });
  });
});
