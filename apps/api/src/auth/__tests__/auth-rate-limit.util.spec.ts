import { mcp } from 'better-auth/plugins';
import { authRateLimit, authRateLimitEnabled } from '../infrastructure/auth-rate-limit.util';

/**
 * When Better Auth's limiter runs, and that the MCP rules name paths the plugin
 * serves. Better Auth matches a custom rule by exact path, so a rule for a path
 * the plugin renamed would match nothing and leave its endpoint on the general
 * hundred a minute without a word.
 */

describe('authRateLimitEnabled', () => {
  it.each([
    [{}, true],
    [{ NODE_ENV: 'development' }, true],
    [{ NODE_ENV: 'production' }, true],
    [{ NODE_ENV: 'test' }, false],
    [{ NODE_ENV: 'development', AUTH_RATE_LIMIT_ENABLED: 'false' }, false],
    [{ NODE_ENV: 'production', AUTH_RATE_LIMIT_ENABLED: 'FALSE' }, false],
    [{ NODE_ENV: 'test', AUTH_RATE_LIMIT_ENABLED: 'true' }, true],
    [{ NODE_ENV: 'development', AUTH_RATE_LIMIT_ENABLED: '' }, true],
    [{ NODE_ENV: 'development', AUTH_RATE_LIMIT_ENABLED: '0' }, true],
  ])('with %o answers %s', (env, enabled) => {
    expect(authRateLimitEnabled(env)).toBe(enabled);
  });
});

describe('authRateLimit', () => {
  it('limits only MCP paths the plugin serves', () => {
    const served = new Set(
      Object.values(mcp({ loginPage: '/login' }).endpoints).map((endpoint) => endpoint.path),
    );
    const mcpRules = Object.keys(authRateLimit({}).customRules ?? {}).filter((path) =>
      path.startsWith('/mcp/'),
    );

    expect(mcpRules.length).toBeGreaterThan(0);
    expect(mcpRules.filter((path) => !served.has(path))).toEqual([]);
  });
});
