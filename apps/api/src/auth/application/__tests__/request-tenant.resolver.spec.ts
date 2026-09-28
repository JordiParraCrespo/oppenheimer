import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { toResourceScope } from '@oppenheimer/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ORGANIZATION_PARAM_KEY,
  type OrganizationScope,
} from '../../decorators/organization-scoped.decorator';
import type { ScopeContext } from '../../domain/scope-context.types';
import { RequestTenantResolver } from '../request-tenant.resolver';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const context = {
  getHandler: () => () => undefined,
  getClass: () => class {},
} as unknown as ExecutionContext;

/** A token restricted to `organizationIds`. */
const tokenFor = (organizationIds: string[]): ScopeContext => ({
  kind: 'api-token',
  credentialId: 'token-1',
  userId: 'u1',
  owner: {
    id: 'u1',
    email: 'u1@example.com',
    firstName: 'U',
    lastName: 'One',
    role: 'user',
    isActive: true,
    emailVerified: true,
  },
  scopes: [],
  resourceScope: toResourceScope(organizationIds),
  expiresAt: null,
});

describe('RequestTenantResolver', () => {
  let metadata: Record<string, unknown>;
  let resolver: RequestTenantResolver;

  const scopedBy = (scope: OrganizationScope) => {
    metadata[ORGANIZATION_PARAM_KEY] = scope;
  };

  beforeEach(() => {
    metadata = {};
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      ((key: string) => metadata[key]) as never,
    );
    resolver = new RequestTenantResolver(reflector);
  });

  describe('on a route that names its organization in the path', () => {
    beforeEach(() => scopedBy({ param: 'orgId', from: 'path' }));

    it("acts in the path's organization, not the session's", () => {
      const request = { params: { orgId: ORG_B }, session: { activeOrganizationId: ORG_A } };

      expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_B });
      expect(request).toMatchObject({ tenant: { organizationId: ORG_B } });
    });

    it('refuses a malformed id, never falling back to the session', () => {
      const request = { params: { orgId: "x' OR 1=1" }, session: { activeOrganizationId: ORG_A } };

      expect(() => resolver.stamp(context, request)).toThrow(
        expect.objectContaining({ code: 'AUTHZ_003' }),
      );
      expect(request).not.toHaveProperty('tenant');
    });

    it('refuses a route whose declared parameter is missing, never falling back to the session', () => {
      const request = { params: {}, session: { activeOrganizationId: ORG_A } };

      expect(() => resolver.stamp(context, request)).toThrow(
        expect.objectContaining({ code: 'AUTHZ_004' }),
      );
      expect(request).not.toHaveProperty('tenant');
    });
  });

  describe('on a route that takes an optional organization in the query', () => {
    beforeEach(() => scopedBy({ param: 'organizationId', from: 'query' }));

    it('acts in the organization the query names', () => {
      const request = {
        query: { organizationId: ORG_B },
        session: { activeOrganizationId: ORG_A },
      };
      expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_B });
    });

    it("acts in the session's organization when the query names none", () => {
      const request = { query: {}, session: { activeOrganizationId: ORG_A } };
      expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_A });
    });

    it('refuses a malformed id there too', () => {
      const request = { query: { organizationId: 'nope' }, session: null };
      expect(() => resolver.stamp(context, request)).toThrow(
        expect.objectContaining({ code: 'AUTHZ_003' }),
      );
    });
  });

  it('reads an optional body field the same way', () => {
    scopedBy({ param: 'organizationId', from: 'body' });
    const request = { body: { organizationId: ORG_B }, session: { activeOrganizationId: ORG_A } };

    expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_B });
  });

  describe('on a route that names no organization', () => {
    it("acts in the session's active organization", () => {
      const request = { session: { activeOrganizationId: ORG_A } };
      expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_A });
    });

    it('acts in no organization when the session has none', () => {
      expect(resolver.stamp(context, { session: null })).toEqual({ organizationId: null });
    });

    it('ignores any X-Active-Organization header: there is no such override', () => {
      const request = {
        headers: { 'x-active-organization': ORG_B },
        session: { activeOrganizationId: ORG_A },
      };
      expect(resolver.stamp(context, request)).toEqual({ organizationId: ORG_A });
    });

    it("acts in a scoped credential's pinned organization before the session exists", () => {
      expect(resolver.stamp(context, {}, tokenFor([ORG_A]))).toEqual({ organizationId: ORG_A });
      expect(resolver.stamp(context, {}, tokenFor([ORG_A, ORG_B]))).toEqual({
        organizationId: null,
      });
    });
  });

  it('stamps once: a second stamp keeps the first tenant, and the field cannot be reassigned', () => {
    const request: Record<string, unknown> = { session: { activeOrganizationId: ORG_A } };

    const first = resolver.stamp(context, request);
    scopedBy({ param: 'orgId', from: 'path' });
    request.params = { orgId: ORG_B };
    const second = resolver.stamp(context, request);

    expect(second).toBe(first);
    expect(() => {
      request.tenant = { organizationId: ORG_B };
    }).toThrow(TypeError);
    expect(request.tenant).toEqual({ organizationId: ORG_A });
  });
});
