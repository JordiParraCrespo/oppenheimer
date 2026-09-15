import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * OAuth provider credentials. Better Auth reads these from the environment
 * directly (see `auth.ts`) and derives the callback URLs as
 * `${BETTER_AUTH_URL}/api/auth/callback/<provider>`. This config object is kept
 * for visibility / validation of the configured providers.
 *
 * Every key here is **optional capability config**: a self-hoster may run
 * without any OAuth provider, so a missing key disables that provider (the
 * `google_oauth` / `github_oauth` capabilities in `CapabilitiesModule`) — it
 * never fails boot, and it never falls back to a sentinel value. Absence is
 * `undefined`, so a consumer that forgets to handle it fails to compile
 * instead of handing a fake client id to the provider.
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
