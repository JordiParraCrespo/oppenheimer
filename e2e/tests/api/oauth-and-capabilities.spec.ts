import { expect, test } from '@playwright/test';
import { newContext } from '../../support/auth';

/**
 * The optional sign-in methods: `GET /health/capabilities` tells a client which
 * ones this deployment has, and a social provider with no key refuses cleanly
 * instead of breaking the app.
 */
test.describe('optional auth providers', () => {
  test('capabilities reports which sign-in methods this deployment has', async () => {
    const api = await newContext();

    const response = await api.get('/api/v1/health/capabilities', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('google_oauth');
    expect(body).toHaveProperty('github_oauth');
    expect(typeof body.google_oauth).toBe('boolean');
  });

  test('an unconfigured social provider fails cleanly instead of crashing', async () => {
    const api = await newContext();
    const capabilities = await (
      await api.get('/api/v1/health/capabilities', { failOnStatusCode: false })
    ).json();
    test.skip(capabilities.google_oauth === true, 'Google is configured on this deployment');

    const response = await api.post('/api/auth/sign-in/social', {
      data: { provider: 'google', callbackURL: '/sessions' },
      failOnStatusCode: false,
    });

    expect(response.status(), 'a disabled provider is "not found", not a 500').toBe(404);
    expect((await response.json()).code).toBe('PROVIDER_NOT_FOUND');
  });

  test('an entirely unknown provider is refused', async () => {
    const api = await newContext();

    const response = await api.post('/api/auth/sign-in/social', {
      data: { provider: 'myspace', callbackURL: '/sessions' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('OAuth provider metadata for MCP clients', () => {
  test('discovery advertises the endpoints and this deployment’s scopes', async () => {
    const api = await newContext();

    const response = await api.get('/api/auth/.well-known/oauth-authorization-server', {
      failOnStatusCode: false,
    });

    expect(response.status()).toBe(200);
    const metadata = await response.json();
    expect(metadata.authorization_endpoint).toContain('/api/auth/mcp/authorize');
    expect(metadata.token_endpoint).toContain('/api/auth/mcp/token');
    // The point of publishing `metadata.scopes_supported` is that a client can
    // see the deployment's own permission catalog, not just the OIDC standards.
    expect(Array.isArray(metadata.scopes_supported)).toBe(true);
    expect(metadata.scopes_supported).toContain('openid');
    expect(
      metadata.scopes_supported.some((scope: string) => scope.includes(':')),
      'the deployment catalog (e.g. profile:read) should be advertised, not only OIDC scopes',
    ).toBe(true);
  });

  test('the token endpoint refuses an unauthenticated grant', async () => {
    const api = await newContext();

    const response = await api.post('/api/auth/mcp/token', {
      form: {
        grant_type: 'authorization_code',
        code: 'made-up',
        client_id: 'nobody',
      },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });
});
