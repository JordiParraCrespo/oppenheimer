import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Slack: a bot's own Slack app, whose events reach the API over HTTP.
 *
 * `tokenKey` is optional capability config: the AES-256-GCM key an app's bot
 * token and signing secret are sealed under, 32 bytes as base64. Without it
 * connecting an app answers `SLACK_003`, and nothing else in the API is
 * affected. `eventsBaseUrl` is the API's public origin as Slack reaches it,
 * `BETTER_AUTH_URL` when unset; `apiUrl` is Slack's Web API, the seam an
 * end-to-end run points at a stub.
 */
const schema = z.object({
  tokenKey: z.string().optional(),
  eventsBaseUrl: z.string().url().optional(),
  apiUrl: z.string().url().default('https://slack.com/api'),
});

export const slackConfig = registerAs('slack', () =>
  parseEnv('slack', schema, {
    tokenKey: 'SLACK_TOKEN_KEY',
    eventsBaseUrl: 'SLACK_EVENTS_BASE_URL',
    apiUrl: 'SLACK_API_URL',
  }),
);

/** A key `SLACK_TOKEN_KEY` can hold: 32 bytes, base64; null otherwise. */
export function slackTokenKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
