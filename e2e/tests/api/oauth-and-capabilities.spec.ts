import { expect, test } from '@playwright/test';
import { newContext } from '../../support/auth';

/**
 * How the deployment behaves when the optional sign-in methods are switched
 * off. The rule the codebase states is that a missing key disables a feature
 * rather than breaking the app, and that `GET /health/capabilities` is how a
 * client finds out — so both halves are asserted here.
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
      data: { provider: 'google', callbackURL: '/dashboard' },
      failOnStatusCode: false,
    });

    expect(response.status(), 'a disabled provider is "not found", not a 500').toBe(404);
    expect((await response.json()).code).toBe('PROVIDER_NOT_FOUND');
  });

  test('an entirely unknown provider is refused', async () => {
    const api = await newContext();

    const response = await api.post('/api/auth/sign-in/social', {
      data: { provider: 'myspace', callbackURL: '/dashboard' },
      failOnStatusCode: false,
    });

    expect(response.status()).toBeGreaterThanOrEqual(400);
    expect(response.status()).toBeLessThan(500);
  });

  test('the API still authenticates by password with every provider off', async () => {
    const { signedUpContext } = await import('../../support/auth');
    const { api, user } = await signedUpContext('nooauth');

    const me = await api.get('/api/v1/users/me', { failOnStatusCode: false });

    expect(me.status()).toBe(200);
    expect((await me.json()).email).toBe(user.email);
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
