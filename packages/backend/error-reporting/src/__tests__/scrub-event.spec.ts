import { describe, expect, it } from 'vitest';
import { REDACTED, scrubEvent } from '../scrub-event';

// Regression: a credential or a request body reaching Sentry, where everyone
// with access to the project can read it.
describe('scrubEvent', () => {
  it('drops credentials from the headers, cookies and query string, and the body whole', () => {
    const event = scrubEvent({
      request: {
        headers: { Authorization: 'Bearer abc', 'X-Api-Key': 'k', 'User-Agent': 'curl' },
        cookies: { 'better-auth.session_token': 'x' },
        data: { prompt: 'my secret plan' },
        query_string: 'page=2&token=abc&code=xyz',
        url: 'https://api.test/api/v1/oauth/callback?code=xyz&page=2',
      },
    });

    expect(event.request?.headers).toEqual({
      Authorization: REDACTED,
      'X-Api-Key': REDACTED,
      'User-Agent': 'curl',
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.data).toBe(REDACTED);
    expect(event.request?.query_string).toBe('page=2&token=%5Bredacted%5D&code=%5Bredacted%5D');
    expect(event.request?.url).toBe(
      'https://api.test/api/v1/oauth/callback?code=%5Bredacted%5D&page=2',
    );
  });

  it('keeps only the id of the user', () => {
    const event = scrubEvent({ user: { id: 'u1', email: 'a@b.c', ip_address: '1.2.3.4' } });
    expect(event.user).toEqual({ id: 'u1' });
  });

  it('redacts secret-named extras and breadcrumb data, and keeps the rest', () => {
    const event = scrubEvent({
      extra: { apiKey: 'k', client_secret: 's', jobId: '42', sessionId: 's1' },
      breadcrumbs: [{ data: { url: 'https://x.test/?access_token=t', status_code: 500 } }],
    });
    expect(event.extra).toEqual({
      apiKey: REDACTED,
      client_secret: REDACTED,
      jobId: '42',
      sessionId: 's1',
    });
    expect(event.breadcrumbs?.[0]?.data).toEqual({
      url: 'https://x.test/?access_token=%5Bredacted%5D',
      status_code: 500,
    });
  });

  it('redacts a credential that is the path itself, and an attach ticket', () => {
    const event = scrubEvent({
      request: { url: 'https://api.test/api/v1/cloud-files/abc.def?ticket=t1&page=2' },
      breadcrumbs: [{ data: { url: '/api/v1/cloud-files/abc.def' } }],
    });
    expect(event.request?.url).toBe(
      'https://api.test/api/v1/cloud-files/[redacted]?ticket=%5Bredacted%5D&page=2',
    );
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('/api/v1/cloud-files/[redacted]');
  });
});
