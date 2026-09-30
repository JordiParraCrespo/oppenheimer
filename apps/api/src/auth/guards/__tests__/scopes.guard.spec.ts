import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CredentialScopeResolver } from '../../application/credential-scope.resolver';
import { RequestTenantResolver } from '../../application/request-tenant.resolver';
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

const ORG_1 = '11111111-1111-4111-8111-111111111111';
const ORG_2 = '22222222-2222-4222-8222-222222222222';

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
    guard = new ScopesGuard(
      reflector,
      credentials as CredentialScopeResolver,
      new RequestTenantResolver(reflector),
    );
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

    it('refuses a credential missing the required scope, naming it', async () => {
      useCredential(tokenContext({ scopes: ['users:read'] }));
      metadata[REQUIRE_SCOPES_KEY] = ['roles:write'];

      await expect(guard.canActivate(context())).rejects.toMatchObject({
        code: 'TOKEN_005',
        detail: expect.stringContaining('roles:write'),
        extensions: { missingScopes: ['roles:write'] },
      });
    });

    it.each([
      ['declares no scopes', undefined],
      ['declares an empty scope list', []],
    ])('refuses a route that %s — closed by default', async (_label, declared) => {
      useCredential(tokenContext());
      metadata[REQUIRE_SCOPES_KEY] = declared;

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
      metadata[ORGANIZATION_PARAM_KEY] = { param: 'orgId', from: 'path' };
    });

    it('admits a request inside the credential’s organizations', async () => {
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope([ORG_1]),
        }),
      );
      request.params = { orgId: ORG_1 };

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it.each([
      ['path', 'orgId', 'params'],
      ['body', 'organizationId', 'body'],
      ['query', 'organizationId', 'query'],
    ] as const)(
      'refuses a %s-named organization outside the restriction',
      async (from, param, field) => {
        metadata[ORGANIZATION_PARAM_KEY] = { param, from };
        useCredential(
          tokenContext({
            scopes: ['members:read'],
            resourceScope: toResourceScope([ORG_1]),
          }),
        );
        request[field] = { [param]: ORG_2 };

        await expect(guard.canActivate(context())).rejects.toMatchObject({
          code: 'TOKEN_007',
        });
      },
    );

    it('ignores the restriction for an unrestricted credential', async () => {
      useCredential(tokenContext({ scopes: ['members:read'] }));
      request.params = { orgId: ORG_2 };

      await expect(guard.canActivate(context())).resolves.toBe(true);
    });

    it('refuses a malformed organization id rather than reading it as no organization', async () => {
      // A restriction admits a request that names no organization, so a
      // malformed id the guard swallowed would walk a restricted token past it.
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope([ORG_1]),
        }),
      );
      request.params = { orgId: 'not-a-uuid' };

      await expect(guard.canActivate(context())).rejects.toMatchObject({ code: 'AUTHZ_003' });
    });

    it('checks the same tenant the request is stamped with, before ApiAuthGuard runs', async () => {
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope([ORG_1]),
        }),
      );
      request.params = { orgId: ORG_1 };

      await guard.canActivate(context());

      // Stamped here, through the one writer; ApiAuthGuard's later stamp is a no-op.
      expect(request.tenant).toEqual({ organizationId: ORG_1 });
    });

    it("acts in a single-organization token's pinned organization on a route that names none", async () => {
      metadata[ORGANIZATION_PARAM_KEY] = undefined;
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope([ORG_1]),
        }),
      );
      // A body or query `organizationId` on a route that does not declare it
      // is not the tenant and cannot move the request out of the restriction.
      request.body = { organizationId: ORG_2 };
      request.query = { organizationId: ORG_2 };

      await expect(guard.canActivate(context())).resolves.toBe(true);
      expect(request.tenant).toEqual({ organizationId: ORG_1 });
    });

    it('leaves a multi-organization token in no organization on a route that names none', async () => {
      metadata[ORGANIZATION_PARAM_KEY] = undefined;
      useCredential(
        tokenContext({
          scopes: ['members:read'],
          resourceScope: toResourceScope([ORG_1, ORG_2]),
        }),
      );
      request.session = { activeOrganizationId: ORG_2 };

      await expect(guard.canActivate(context())).resolves.toBe(true);
      // Null means no organization's roles, grants or rows: global roles only,
      // so there is nothing outside the restriction to reach.
      expect(request.tenant).toEqual({ organizationId: null });
    });
  });

  it('ignores non-HTTP execution contexts', async () => {
    const rpcContext = { getType: () => 'rpc' } as unknown as ExecutionContext;
    await expect(guard.canActivate(rpcContext)).resolves.toBe(true);
    expect(credentials.resolve).not.toHaveBeenCalled();
  });
});
