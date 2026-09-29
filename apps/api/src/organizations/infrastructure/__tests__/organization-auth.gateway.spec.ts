import type { IncomingHttpHeaders } from 'node:http';
import { APIError } from 'better-auth/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../auth/infrastructure/better-auth.config', () => ({
  auth: {
    api: {
      createOrganization: vi.fn(),
      updateOrganization: vi.fn(),
      deleteOrganization: vi.fn(),
      setActiveOrganization: vi.fn(),
      listOrganizations: vi.fn(),
      getFullOrganization: vi.fn(),
      checkOrganizationSlug: vi.fn(),
      addMember: vi.fn(),
      removeMember: vi.fn(),
      updateMemberRole: vi.fn(),
      leaveOrganization: vi.fn(),
    },
  },
}));

import { auth } from '../../../auth/infrastructure/better-auth.config';
import { OrganizationAuthGateway } from '../organization-auth.gateway';

const api = auth.api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const headers: IncomingHttpHeaders = { cookie: 'session=abc' };

const orgRecord = {
  id: 'org1',
  name: 'Acme',
  slug: 'acme',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const memberRecord = {
  id: 'm1',
  organizationId: 'org1',
  userId: 'u1',
  role: 'owner',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('OrganizationAuthGateway', () => {
  let gateway: OrganizationAuthGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new OrganizationAuthGateway();
  });

  it('creates an organization with the name, slug and logo given', async () => {
    api.createOrganization.mockResolvedValue(orgRecord);

    const result = await gateway.create(headers, { name: 'Acme', slug: 'custom-slug' });

    expect(result.id).toBe('org1');
    expect(api.createOrganization.mock.calls[0][0].body).toEqual({
      name: 'Acme',
      slug: 'custom-slug',
      logo: undefined,
    });
    expect(api.createOrganization.mock.calls[0][0].headers).toBeInstanceOf(Headers);
  });

  it('updates an organization', async () => {
    api.updateOrganization.mockResolvedValue(orgRecord);
    await gateway.update(headers, 'org1', { name: 'Acme 2' });
    expect(api.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { data: { name: 'Acme 2' }, organizationId: 'org1' },
      }),
    );
  });

  it('deletes an organization', async () => {
    api.deleteOrganization.mockResolvedValue(orgRecord);
    const result = await gateway.delete(headers, 'org1');
    expect(result.id).toBe('org1');
    expect(api.deleteOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: { organizationId: 'org1' } }),
    );
  });

  describe('setActive', () => {
    it('maps the organization when Better Auth returns one', async () => {
      api.setActiveOrganization.mockResolvedValue(orgRecord);
      expect((await gateway.setActive(headers, 'org1'))?.id).toBe('org1');
    });

    it('returns null when Better Auth returns a falsy result (cleared active org)', async () => {
      api.setActiveOrganization.mockResolvedValue(null);
      expect(await gateway.setActive(headers, 'org1')).toBeNull();
    });
  });

  describe('getFull', () => {
    it('maps a full organization', async () => {
      api.getFullOrganization.mockResolvedValue({ ...orgRecord, members: [memberRecord] });
      expect((await gateway.getFull(headers, 'org1'))?.members).toHaveLength(1);
    });

    it('returns null when no organization is found', async () => {
      api.getFullOrganization.mockResolvedValue(null);
      expect(await gateway.getFull(headers, 'org1')).toBeNull();
    });
  });

  describe('isSlugAvailable', () => {
    it('is true when Better Auth does not throw', async () => {
      api.checkOrganizationSlug.mockResolvedValue({ status: true });
      expect(await gateway.isSlugAvailable(headers, 'free-slug')).toBe(true);
    });

    it('is false when Better Auth says the slug is taken', async () => {
      api.checkOrganizationSlug.mockRejectedValue(
        new APIError('BAD_REQUEST', {
          message: 'Organization slug already taken',
          code: 'ORGANIZATION_SLUG_ALREADY_TAKEN',
        }),
      );
      expect(await gateway.isSlugAvailable(headers, 'taken-slug')).toBe(false);
    });

    // Not every refusal means "taken": signed out, or the plugin refusing the
    // request, is a problem the caller is told about.
    it('reports any other Better Auth refusal as the problem it is', async () => {
      api.checkOrganizationSlug.mockRejectedValue(
        new APIError('UNAUTHORIZED', { message: 'no session' }),
      );
      await expect(gateway.isSlugAvailable(headers, 'x')).rejects.toMatchObject({
        code: 'ORG_003',
      });
    });

    it('reports a transport failure as an upstream failure', async () => {
      api.checkOrganizationSlug.mockRejectedValue(new Error('network down'));
      await expect(gateway.isSlugAvailable(headers, 'x')).rejects.toMatchObject({
        code: 'ORG_016',
      });
    });
  });

  it('adds a member forwarding role and teamId', async () => {
    api.addMember.mockResolvedValue({ ...memberRecord, role: 'member' });
    await gateway.addMember(headers, 'org1', { userId: 'u1', role: 'member', teamId: 'team1' });
    expect(api.addMember).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { userId: 'u1', role: 'member', organizationId: 'org1', teamId: 'team1' },
      }),
    );
  });

  it('removes a member unwrapping the `{ member }` envelope', async () => {
    api.removeMember.mockResolvedValue({ member: memberRecord });
    const result = await gateway.removeMember(headers, 'org1', 'm1');
    expect(result.id).toBe('m1');
    expect(api.removeMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { memberIdOrEmail: 'm1', organizationId: 'org1' } }),
    );
  });

  it('updates a member role', async () => {
    api.updateMemberRole.mockResolvedValue(memberRecord);
    await gateway.updateMemberRole(headers, 'org1', 'm1', 'admin');
    expect(api.updateMemberRole).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { memberId: 'm1', role: 'admin', organizationId: 'org1' },
      }),
    );
  });
});
