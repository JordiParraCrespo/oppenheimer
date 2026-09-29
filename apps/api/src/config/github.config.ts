import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { parseEnv } from './env';

/**
 * The sessions GitHub App (`product/versions/mvp/03-control-plane.md`).
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
  /**
   * Where GitHub's REST API lives, up to but not including a trailing slash.
   *
   * Defaulted rather than optional, because unlike the six above this one is
   * never absent — a deployment either talks to github.com or to a GitHub
   * Enterprise Server, and the second is the reason this is configurable at
   * all. It is also the seam an end-to-end run points at a stub, so a create
   * path that needs a repository can be exercised without registering an App.
   *
   * **The variable is `GITHUB_APP_API_URL`, not `GITHUB_API_URL`, and that is
   * not a matter of taste.** `GITHUB_API_URL` is one of the environment
   * variables GitHub Actions defines in every step, set to
   * `https://api.github.com` — and `@oppenheimer/env` lets a real environment
   * variable win over the root `.env`, as it must. So a deployment or a test
   * run that lives inside Actions would have had this silently overridden by
   * the runner, which is exactly what happened the first time the end-to-end
   * job tried to point the API at its stub: the OAuth URL took effect, the
   * API URL did not, and the suite talked to the real github.com. The
   * `GITHUB_APP_` prefix the other six already carry is outside that reserved
   * namespace.
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
