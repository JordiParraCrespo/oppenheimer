import type { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarRateLimitedError } from '../infrastructure/calendar-provider.port';
import { GoogleCalendarGateway } from '../infrastructure/google-calendar.gateway';

/**
 * Google refuses for quota with a 403 as often as a 429, and says so only in
 * the body. Read as an ordinary failure, the month view would keep asking and
 * keep being refused; these pin that it pauses the grant instead.
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

afterEach(() => vi.unstubAllGlobals());

describe('GoogleCalendarGateway and Google’s quota', () => {
  it('pauses a grant Google refused for quota, and does not ask again until then', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(json(200, { access_token: 'ya29.token' }))
      .mockResolvedValueOnce(
        json(403, { error: { errors: [{ reason: 'userRateLimitExceeded' }], code: 403 } }),
      );
    vi.stubGlobal('fetch', fetch);
    const gateway = new GoogleCalendarGateway(config);

    await expect(gateway.listEvents('1//refresh', RANGE)).rejects.toBeInstanceOf(
      CalendarRateLimitedError,
    );
    await expect(gateway.listEvents('1//refresh', RANGE)).rejects.toBeInstanceOf(
      CalendarRateLimitedError,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('leaves a 403 that is not about quota an ordinary provider failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(200, { access_token: 'ya29.token' }))
        .mockResolvedValueOnce(json(403, { error: { errors: [{ reason: 'forbidden' }] } })),
    );

    await expect(
      new GoogleCalendarGateway(config).listEvents('1//refresh', RANGE),
    ).rejects.not.toBeInstanceOf(CalendarRateLimitedError);
  });
});
