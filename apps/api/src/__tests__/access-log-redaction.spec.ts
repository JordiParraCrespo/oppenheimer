import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanRoutes } from './route-scopes';

/**
 * The console's nginx writes every request's path to its access log, and the
 * log goes to Loki. A route that carries a credential in its path (a
 * routine's webhook token, a cloud file's token, a password reset's) has that
 * segment written as `[redacted]` by one `map` in `apps/web/nginx.conf`, which
 * lists the routes by hand. This finds every such route, in the controllers
 * and in Better Auth, and runs a request for each through that map: a new
 * route the map misses fails here, rather than leaking its secrets into the
 * log.
 *
 * A route param counts as a credential when its name says token, secret,
 * ticket or key; one that only sounds like it is listed in `NOT_A_CREDENTIAL`
 * with what it holds.
 */

const NGINX_CONF = resolve(__dirname, '../../../web/nginx.conf');
const BETTER_AUTH_CONFIG = resolve(__dirname, '../auth/infrastructure/better-auth.config.ts');
const BETTER_AUTH_BASE_PATH = '/api/auth';
const API_PREFIX = '/api';

const CREDENTIAL_PARAM = /token|secret|ticket|key/i;

/** Route paths (no verb, no `/api`) whose credential-sounding param is not one. */
const NOT_A_CREDENTIAL: Record<string, string> = {
  '/v1/feature-flags/admin/:key': "a feature flag's catalog key, its name",
  '/v1/feature-flags/admin/:key/evaluate': "a feature flag's catalog key, its name",
  '/v1/feature-flags/segments/:key': "a segment's key, its name",
  '/v1/inbox/marks/:itemKey': 'which inbox item a mark is on, not a secret',
  '/v1/model-providers/:provider/keys/:keyId': "a stored provider key's row id, never the key",
};

const SECRET = 'S3CRET-in-the-path';

/** `path` as a request would send it: the credential param a secret, every other param a plain id. */
function requestPath(path: string): string {
  return path.replace(/:([A-Za-z]\w*)/g, (_, name: string) =>
    CREDENTIAL_PARAM.test(name) ? SECRET : 'some-id',
  );
}

/** Every path that holds a credential-named param, `/api` included. */
function credentialPaths(paths: Iterable<string>, prefix: string): string[] {
  const found = new Set<string>();
  for (const path of paths) {
    const params = [...path.matchAll(/:([A-Za-z]\w*)/g)].map((match) => match[1]);
    if (params.some((name) => CREDENTIAL_PARAM.test(name)) && !(path in NOT_A_CREDENTIAL)) {
      found.add(`${prefix}${path}`);
    }
  }
  return [...found].sort();
}

/** The controllers' route paths, verb and duplicates dropped. */
function controllerPaths(): string[] {
  const { routes, unreadable } = scanRoutes();
  // A controller the scan could not read is a route it could not check.
  if (unreadable.length > 0) throw new Error(`unreadable routes:\n${unreadable.join('\n')}`);
  return [...new Set(routes.map(({ route }) => route.slice(route.indexOf(' ') + 1)))];
}

/** Every route path Better Auth's build declares, its plugins' included. */
function betterAuthPaths(): string[] {
  const root = dirname(require.resolve('better-auth'));
  const paths = new Set<string>();
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.mjs')) {
        for (const match of readFileSync(path, 'utf8').matchAll(
          /["'`](\/[\w/.-]*:\w+[\w/:.-]*)["'`]/g,
        )) {
          paths.add(match[1]);
        }
      }
    }
  };
  walk(root);
  return [...paths];
}

/** The `$oppenheimer_log_uri` map's regex rules, as JavaScript: what each rewrites a path to. */
function nginxRedaction(): (uri: string) => string {
  const conf = readFileSync(NGINX_CONF, 'utf8');
  const block = /map \$uri \$oppenheimer_log_uri \{([\s\S]*?)\n\}/.exec(conf)?.[1];
  if (!block) throw new Error('no `map $uri $oppenheimer_log_uri` block in nginx.conf');
  const rules = [...block.matchAll(/^\s*"~(.+)"\s+"(.+)";$/gm)].map(([, pattern, replacement]) => ({
    pattern: new RegExp(pattern),
    replacement: replacement.replace(/\$\{(\w+)\}/g, '$<$1>'),
  }));
  if (rules.length === 0) throw new Error('the `$oppenheimer_log_uri` map has no regex rule');
  return (uri) => {
    // nginx's `map` takes the first regex that matches, in the order written.
    const rule = rules.find(({ pattern }) => pattern.test(uri));
    return rule ? uri.replace(rule.pattern, rule.replacement) : uri;
  };
}

describe('access log redaction', () => {
  const redact = nginxRedaction();
  const routes = [
    ...credentialPaths(controllerPaths(), API_PREFIX),
    ...credentialPaths(betterAuthPaths(), BETTER_AUTH_BASE_PATH),
  ];

  it('finds the routes that carry a credential in their path', () => {
    expect(readFileSync(BETTER_AUTH_CONFIG, 'utf8')).toContain(
      `basePath: '${BETTER_AUTH_BASE_PATH}'`,
    );
    // The ones the map was written for: if the scan stops seeing them, it is
    // the scan that broke.
    expect(routes).toEqual(
      expect.arrayContaining([
        '/api/auth/reset-password/:token',
        '/api/v1/cloud-files/:token',
        '/api/v1/routine-webhooks/:token',
      ]),
    );
  });

  it.each(routes)('writes no credential of %s to the access log', (route) => {
    const logged = redact(requestPath(route));

    expect(logged).not.toContain(SECRET);
    expect(logged).toContain('[redacted]');
  });

  it('keeps the rest of the path, so a log line still says what was asked', () => {
    expect(redact(`/api/v1/routine-webhooks/${SECRET}/extra`)).toBe(
      '/api/v1/routine-webhooks/[redacted]/extra',
    );
    expect(redact('/api/v1/hosts/some-id')).toBe('/api/v1/hosts/some-id');
  });

  it('lists only routes that exist as not holding a credential', () => {
    const paths = new Set(controllerPaths());
    for (const path of Object.keys(NOT_A_CREDENTIAL)) expect(paths).toContain(path);
  });
});
