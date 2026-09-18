import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialScopeResolver } from '../../application/credential-scope.resolver';
import { ORGANIZATION_PARAM_KEY } from '../../decorators/organization-scoped.decorator';
import { ALLOW_ANY_SCOPE_KEY, REQUIRE_SCOPES_KEY } from '../../decorators/require-scopes.decorator';
import type { ScopeContext } from '../../domain/scope-context.types';
import { ScopesGuard } from '../scopes.guard';

const tokenContext = (overrides: Partial<ScopeContext> = {}): ScopeContext => ({
  kind: 'api-token',
  credentialId: 'token-1',
  userId: 'user-1',
  owner: {
    id: 'user-1',
    email: 'owner@example.com',
    firstName: 'Owner',
    lastName: 'Example',
    role: 'user',
    isActive: true,
    emailVerified: true,
  },
  scopes: ['users:read'],
  resourceScope: toResourceScope(null),
  expiresAt: null,
  ...overrides,
});

describe('ScopesGuard', () => {
  let guard: ScopesGuard;
  let reflector: Reflector;
  let credentials: Pick<CredentialScopeResolver, 'resolve'>;
  let request: Record<string, unknown>;
  let metadata: Record<string, unknown>;

  const context = () =>
    ({
      getType: () => 'http',
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    request = { params: {}, body: {}, query: {} };
    metadata = {};
    reflector = new Reflector();
    // `getAllAndOverride` is heavily overloaded; the cast keeps the stub simple.
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      ((key: string) => metadata[key]) as never,
    );
    credentials = { resolve: vi.fn().mockResolvedValue(null) };
    guard = new ScopesGuard(reflector, credentials as CredentialScopeResolver);
  });

  const useCredential = (ctx: ScopeContext | null) => {
    vi.mocked(credentials.resolve).mockResolvedValue(ctx);
  };

  describe('browser sessions', () => {
    it('lets an unscoped request through untouched', async () => {
      metadata[REQUIRE_SCOPES_KEY] = ['users:read'];
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('lets an unscoped request reach a route that declares no scopes', async () => {
      await expect(guard.canActivate(context())).resolves.toBe(true);
    });
  });

  describe('scoped credentials', () => {
    it('admits a credential carrying the required scope', async () => {
      useCredential(tokenContext({ scopes: ['users:read'] }));
      metadata[REQUIRE_SCOPES_KEY] = ['users:read'];

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('admits a write credential on a read route', async () => {
      useCredential(tokenContext({ scopes: ['users:write'] }));
      metadata[REQUIRE_SCOPES_KEY] = ['users:read'];

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses a credential missing the required scope', async () => {
      useCredential(tokenContext({ scopes: ['users:read'] }));
      metadata[REQUIRE_SCOPES_KEY] = ['roles:write'];

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_005',
      });
    });

    it('names the missing scope in the error', async () => {
      useCredential(tokenContext({ scopes: ['users:read'] }));
      metadata[REQUIRE_SCOPES_KEY] = ['roles:write'];

      // The catalog message titles the problem type; what is missing on *this*
      // request is the problem's detail (RFC 7807).
      await expect(guard.canActivate(context())).rejects.toMatchObject({
        detail: expect.stringContaining('roles:write'),
        extensions: { missingScopes: ['roles:write'] },
      });
    });

    it('refuses a route that declares no scopes — closed by default', async () => {
      useCredential(tokenContext());

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_006',
      });
    });

    it('refuses a route whose declared scope list is empty', async () => {
      useCredential(tokenContext());
      metadata[REQUIRE_SCOPES_KEY] = [];

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_006',
      });
    });

    it('admits a credential on an explicitly permission-free route', async () => {
      useCredential(tokenContext({ scopes: [] }));
      metadata[ALLOW_ANY_SCOPE_KEY] = true;

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });
  });

  describe('organization restriction', () => {
    beforeEach(() => {
      metadata[REQUIRE_SCOPES_KEY] = ['members:read'];
      metadata[ORGANIZATION_PARAM_KEY] = 'orgId';
    });

    it('admits a request inside the credential’s organizations', async () => {
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope(['org-1']),
        }),
      );
      request.params = { orgId: 'org-1' };

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses a request against another organization', async () => {
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope(['org-1']),
        }),
      );
      request.params = { orgId: 'org-2' };

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_007',
      });
    });

    it('ignores the restriction for an unrestricted credential', async () => {
      useCredential(tokenContext({ scopes: ['members:read'] }));
      request.params = { orgId: 'org-2' };

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('also reads the organization from the request body', async () => {
      metadata[ORGANIZATION_PARAM_KEY] = undefined;
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope(['org-1']),
        }),
      );
      request.body = { organizationId: 'org-2' };

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_007',
      });
    });

    it('also reads the organization from the query string', async () => {
      metadata[ORGANIZATION_PARAM_KEY] = undefined;
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope(['org-1']),
        }),
      );
      request.query = { organizationId: 'org-2' };

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_007',
      });
    });

    it('allows a route that names no organization at all', async () => {
      metadata[ORGANIZATION_PARAM_KEY] = undefined;
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope(['org-1']),
        }),
      );

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });
  });

  it('ignores non-HTTP execution contexts', async () => {
    const rpcContext = { getType: () => 'rpc' } as unknown as ExecutionContext;
    await expect(guard.canActivate(rpcContext)).resolves.toBe(true);
    expect(credentials.resolve).not.toHaveBeenCalled();
  });
});
