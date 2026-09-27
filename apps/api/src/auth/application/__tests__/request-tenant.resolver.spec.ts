import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORGANIZATION_PARAM_KEY } from '../../decorators/organization-scoped.decorator';
import type { ActiveOrganizationPort } from '../active-organization.port';
import { RequestTenantResolver } from '../request-tenant.resolver';

const ORG_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const context = {
  getHandler: () => () => undefined,
  getClass: () => class {},
} as unknown as ExecutionContext;

describe('RequestTenantResolver', () => {
  let metadata: Record<string, unknown>;
  let activeOrganization: { resolve: ReturnType<typeof vi.fn> };
  let resolver: RequestTenantResolver;

  beforeEach(() => {
    metadata = {};
    const reflector = new Reflector();
    vi.spyOn(reflector, 'getAllAndOverride').mockImplementation(
      ((key: string) => metadata[key]) as never,
    );
    activeOrganization = { resolve: vi.fn().mockResolvedValue(ORG_B) };
    resolver = new RequestTenantResolver(
      reflector,
      activeOrganization as unknown as ActiveOrganizationPort,
    );
  });

  describe('on an @OrganizationScoped route', () => {
    beforeEach(() => {
      metadata[ORGANIZATION_PARAM_KEY] = 'orgId';
    });

    it("acts in the path's organization, not the session's", async () => {
      const request = {
        params: { orgId: ORG_B },
        user: { id: 'u1' },
        session: { activeOrganizationId: ORG_A },
        headers: { 'x-active-organization': ORG_A },
      };

      await expect(resolver.stamp(context, request)).resolves.toEqual({
        organizationId: ORG_B,
        source: 'route',
      });
      expect(request).toMatchObject({ tenant: { organizationId: ORG_B, source: 'route' } });
      // The path already said; the header is not consulted.
      expect(activeOrganization.resolve).not.toHaveBeenCalled();
    });

    it('refuses a malformed id before any lookup, never falling back to the session', async () => {
      const request = {
        params: { orgId: "x' OR 1=1" },
        user: { id: 'u1' },
        session: { activeOrganizationId: ORG_A },
      };

      await expect(resolver.stamp(context, request)).rejects.toMatchObject({
        code: 'AUTHZ_003',
        status: 400,
      });
      expect(request).not.toHaveProperty('tenant');
      expect(activeOrganization.resolve).not.toHaveBeenCalled();
    });

    it('refuses a route whose declared parameter is missing, never falling back to the session', async () => {
      const request = { params: {}, session: { activeOrganizationId: ORG_A } };

      await expect(resolver.stamp(context, request)).rejects.toMatchObject({
        code: 'AUTHZ_004',
      });
      expect(request).not.toHaveProperty('tenant');
    });
  });

  describe('on a route that names no organization', () => {
    it("acts in the session's active organization", async () => {
      const request = { user: { id: 'u1' }, session: { activeOrganizationId: ORG_A } };

      await expect(resolver.stamp(context, request)).resolves.toEqual({
        organizationId: ORG_A,
        source: 'session',
      });
    });

    it('acts in no organization when the session has none', async () => {
      await expect(resolver.stamp(context, { user: { id: 'u1' }, session: null })).resolves.toEqual(
        { organizationId: null, source: 'session' },
      );
    });

    it('acts in a header-named organization once the port has checked the membership', async () => {
      const request = {
        user: { id: 'u1' },
        session: { activeOrganizationId: ORG_A },
        headers: { 'x-active-organization': ` ${ORG_B} ` },
      };

      await expect(resolver.stamp(context, request)).resolves.toEqual({
        organizationId: ORG_B,
        source: 'header',
      });
      expect(activeOrganization.resolve).toHaveBeenCalledWith({
        userId: 'u1',
        sessionOrganizationId: ORG_A,
        header: ORG_B,
      });
    });
  });

  it('stamps once: a second stamp keeps the first tenant, and the field cannot be reassigned', async () => {
    const request: Record<string, unknown> = {
      user: { id: 'u1' },
      session: { activeOrganizationId: ORG_A },
    };

    const first = await resolver.stamp(context, request);
    metadata[ORGANIZATION_PARAM_KEY] = 'orgId';
    request.params = { orgId: ORG_B };
    const second = await resolver.stamp(context, request);

    expect(second).toBe(first);
    expect(() => {
      request.tenant = { organizationId: ORG_B, source: 'route' };
    }).toThrow(TypeError);
    expect(request.tenant).toEqual({ organizationId: ORG_A, source: 'session' });
  });
});
