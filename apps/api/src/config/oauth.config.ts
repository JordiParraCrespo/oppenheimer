import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * OAuth provider credentials. Better Auth reads these from the environment directly
 * (`auth/infrastructure/better-auth.config.ts`) and derives callback URLs as
 * `${BETTER_AUTH_URL}/api/auth/callback/<provider>`; this object validates them and
 * feeds the `google_oauth` / `github_oauth` capabilities.
 *
 * Every key is optional capability config: a missing key disables that provider and
 * never fails boot or falls back to a sentinel. Absence is `undefined`, so a consumer
 * that forgets it fails to compile instead of handing a fake client id to the provider.
 */
const schema = z.object({
  google: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }),
  github: z.object({
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }),
});

export const oauthConfig = registerAs('oauth', () =>
  parseEnv('oauth', schema, {
    'google.clientId': 'GOOGLE_CLIENT_ID',
    'google.clientSecret': 'GOOGLE_CLIENT_SECRET',
    'github.clientId': 'GITHUB_CLIENT_ID',
    'github.clientSecret': 'GITHUB_CLIENT_SECRET',
  }),
);
