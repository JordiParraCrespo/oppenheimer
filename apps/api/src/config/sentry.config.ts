import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * Sentry as a trigger source (`product/next-steps/sentry.md`).
 *
 * `sealKey` is optional capability config: the AES-256-GCM key a workspace's
 * Sentry client secret is sealed under, 32 bytes as base64. Without it the
 * connection routes answer `SENTRY_001`, and nothing else is affected. Not
 * to be confused with `SENTRY_DSN`, where the API reports its own errors.
 */
const schema = z.object({
  sealKey: z.string().optional(),
});

export const sentryConfig = registerAs('sentry', () =>
  parseEnv('sentry', schema, { sealKey: 'SENTRY_CONNECTION_KEY' }),
);

/** A key `SENTRY_CONNECTION_KEY` can hold: 32 bytes, base64; null otherwise. */
export function sentrySealKeyOf(value: string | undefined): Buffer | null {
  if (!value) return null;
  const key = Buffer.from(value, 'base64');
  return key.length === 32 ? key : null;
}
