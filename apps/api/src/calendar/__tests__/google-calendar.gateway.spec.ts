import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleCalendarGateway } from '../infrastructure/google-calendar.gateway';

/**
 * Google refuses for quota with a 403 as often as a 429, and says which quota
 * only in the body: a person's own, or the project's that every connected
 * account shares. Read as an ordinary failure, the month view keeps asking and
 * keeps being refused; these pin that the right bucket is paused instead.
 */

const CONFIG: Record<string, string> = {
  'calendar.googleOauthBaseUrl': 'https://oauth2.example.test',
  'calendar.googleApiBaseUrl': 'https://calendar.example.test',
  'oauth.google.clientId': 'client',
  'oauth.google.clientSecret': 'secret',
  'app.frontendUrl': 'https://console.example.test',
};

const config = {
  get: (key: string) => CONFIG[key],
  getOrThrow: (key: string) => CONFIG[key],
} as unknown as ConfigService;

const RANGE = { from: '2026-10-01', to: '2026-10-31', timeZone: 'Europe/Madrid' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const TOKEN = () => json(200, { access_token: 'ya29.token' });
const refusal = (reason: string) =>
  json(403, { error: { code: 403, errors: [{ reason }], message: 'Quota exceeded' } });

afterEach(() => vi.unstubAllGlobals());

describe('GoogleCalendarGateway and Google’s quota', () => {
  it('pauses a person Google refused for their own quota, and only that person', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(refusal('userRateLimitExceeded'))
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(json(200, { items: [] }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GoogleCalendarGateway(config);

    await expect(gateway.listEvents('1//ana', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    await expect(gateway.listEvents('1//ana', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    await expect(gateway.listEvents('1//ben', RANGE)).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('pauses every person when Google refused for the project’s quota', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(TOKEN())
      .mockResolvedValueOnce(refusal('rateLimitExceeded'));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GoogleCalendarGateway(config);

    await expect(gateway.listEvents('1//ana', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    // Ben's token refresh draws on the same project quota: not sent either.
    await expect(gateway.listEvents('1//ben', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('guards the token endpoint too, not only the events read', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json(429, { error: 'rate_limit_exceeded' }));
    vi.stubGlobal('fetch', fetch);
    const gateway = new GoogleCalendarGateway(config);

    await expect(gateway.listEvents('1//ana', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    await expect(gateway.listEvents('1//ana', RANGE)).rejects.toMatchObject({
      code: 'CALENDAR_010',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('leaves a 403 that is not about quota an ordinary provider failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(TOKEN()).mockResolvedValueOnce(refusal('forbidden')),
    );

    await expect(new GoogleCalendarGateway(config).listEvents('1//ana', RANGE)).rejects.toThrow(
      'Google answered 403',
    );
  });
});
