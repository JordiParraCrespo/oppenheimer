import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The sessions GitHub App (`product/09-github-app-install.md`).
 *
 * Every value is **optional capability config**: without them the app boots,
 * `GET /installations` answers an empty list, and every GitHub-backed route
 * answers `GITHUB_002` — a self-hoster who has not registered an App has no
 * repository access, not a broken API. All six are needed together, which is
 * what the `github_app` capability reports.
 *
 * Deliberately a namespace of its own rather than more keys under `oauth.github`:
 * that pair is Better Auth's *sign-in* provider, a different App with different
 * credentials, and folding them together would make one of them impossible to
 * rotate alone.
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
});

export const githubAppConfig = registerAs('githubApp', () =>
  parseEnv('githubApp', schema, {
    appId: 'GITHUB_APP_ID',
    privateKey: 'GITHUB_APP_PRIVATE_KEY',
    webhookSecret: 'GITHUB_APP_WEBHOOK_SECRET',
    clientId: 'GITHUB_APP_CLIENT_ID',
    clientSecret: 'GITHUB_APP_CLIENT_SECRET',
    slug: 'GITHUB_APP_SLUG',
  }),
);
