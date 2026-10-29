import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Mail: a person's own Gmail accounts, worked by their bots
 * (`product/next-steps/mail.md`).
 *
 * `tokenKey` is optional capability config: with it and the Google sign-in
 * client (`GOOGLE_CLIENT_ID`/`_SECRET`, the same client), the `gmail`
 * capability is on; without either, the Gmail routes answer `MAIL_004` and no
 * bot is offered a mail tool. It is the AES-256-GCM key a connection's refresh
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
  gmailApiBaseUrl: z.string().url().default('https://gmail.googleapis.com'),
});

export const mailConfig = registerAs('mail', () =>
  parseEnv('mail', schema, {
    tokenKey: 'MAIL_TOKEN_KEY',
    googleAuthUrl: 'MAIL_GOOGLE_AUTH_URL',
    googleOauthBaseUrl: 'MAIL_GOOGLE_OAUTH_URL',
    gmailApiBaseUrl: 'MAIL_GMAIL_API_URL',
  }),
);

/** A key `MAIL_TOKEN_KEY` can hold: 32 bytes, base64. */
export function mailTokenKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
