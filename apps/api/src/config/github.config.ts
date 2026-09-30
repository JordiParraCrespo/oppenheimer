import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The sessions GitHub App (`product/versions/mvp/03-control-plane.md`).
 *
 * Every value is optional capability config: without them the app boots,
 * `GET /installations` answers an empty list and every GitHub-backed route answers
 * `GITHUB_002`. All six are needed together, which is what the `github_app` capability
 * reports.
 *
 * A namespace of its own rather than keys under `oauth.github`: that pair is Better
 * Auth's sign-in provider, a different App whose credentials must rotate alone.
 */
const schema = z.object({
  appId: z.string().optional(),
  /** The App's PEM private key. Never in the database, never on a host (F20). */
  privateKey: z.string().optional(),
  webhookSecret: z.string().optional(),
  /** The App's OAuth pair, used once per install to prove the caller's claim. */
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  /** The App's URL slug, so the console can link to its install page. */
  slug: z.string().optional(),
  /**
   * Where GitHub's REST API lives, without a trailing slash. Defaulted, not optional:
   * a deployment talks to github.com or to a GitHub Enterprise Server, and this is the
   * seam an end-to-end run points at a stub.
   *
   * The variable is `GITHUB_APP_API_URL`, never `GITHUB_API_URL`: GitHub Actions sets
   * `GITHUB_API_URL=https://api.github.com` in every step and `@oppenheimer/env` lets a
   * real env var win over `.env`, so inside Actions the stub URL was silently overridden
   * and the e2e suite talked to the real github.com.
   */
  apiBaseUrl: z.string().url().default('https://api.github.com'),
  /**
   * Where the OAuth code is exchanged. A different host from the API on
   * github.com, and on Enterprise Server a different path on the same one, so
   * it is stated separately rather than derived. Prefixed for the same reason
   * as the one above.
   */
  oauthBaseUrl: z.string().url().default('https://github.com'),
});

export const githubAppConfig = registerAs('githubApp', () =>
  parseEnv('githubApp', schema, {
    appId: 'GITHUB_APP_ID',
    privateKey: 'GITHUB_APP_PRIVATE_KEY',
    webhookSecret: 'GITHUB_APP_WEBHOOK_SECRET',
    clientId: 'GITHUB_APP_CLIENT_ID',
    clientSecret: 'GITHUB_APP_CLIENT_SECRET',
    slug: 'GITHUB_APP_SLUG',
    apiBaseUrl: 'GITHUB_APP_API_URL',
    oauthBaseUrl: 'GITHUB_APP_OAUTH_URL',
  }),
);
