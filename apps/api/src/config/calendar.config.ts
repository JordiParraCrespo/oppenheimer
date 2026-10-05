import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Plan's calendar and its read-only Google Calendar layer
 * (`product/versions/mvp/20-plan-calendar.md` §4–5).
 *
 * `tokenKey` is optional capability config: with it and the Google sign-in client
 * (`GOOGLE_CLIENT_ID`/`_SECRET`, the same client), the `google_calendar` capability
 * is on; without either, the Google layer's routes answer `CALENDAR_004` and the
 * rest of Plan is unaffected. It is the AES-256-GCM key a connection's refresh
 * token is sealed under, 32 bytes as base64, and never leaves the API.
 */
const schema = z.object({
  tokenKey: z.string().optional(),
  /**
   * Google's endpoints, defaulted rather than optional: a deployment talks to
   * Google, and these are the seam an end-to-end run points at a stub.
   */
  googleAuthUrl: z.string().url().default('https://accounts.google.com/o/oauth2/v2/auth'),
  googleOauthBaseUrl: z.string().url().default('https://oauth2.googleapis.com'),
  googleApiBaseUrl: z.string().url().default('https://www.googleapis.com'),
});

export const calendarConfig = registerAs('calendar', () =>
  parseEnv('calendar', schema, {
    tokenKey: 'CALENDAR_TOKEN_KEY',
    googleAuthUrl: 'CALENDAR_GOOGLE_AUTH_URL',
    googleOauthBaseUrl: 'CALENDAR_GOOGLE_OAUTH_URL',
    googleApiBaseUrl: 'CALENDAR_GOOGLE_API_URL',
  }),
);

/** A key `CALENDAR_TOKEN_KEY` can hold: 32 bytes, base64. */
export function calendarTokenKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
