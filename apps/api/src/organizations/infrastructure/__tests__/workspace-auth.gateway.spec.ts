import type { IncomingHttpHeaders } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../auth/infrastructure/better-auth.config', () => ({
  auth: {
    api: {
      createTeam: vi.fn(),
      updateTeam: vi.fn(),
      removeTeam: vi.fn(),
      setActiveTeam: vi.fn(),
      listOrganizationTeams: vi.fn(),
      listUserTeams: vi.fn(),
      listTeamMembers: vi.fn(),
      addTeamMember: vi.fn(),
      removeTeamMember: vi.fn(),
    },
  },
}));

import { auth } from '../../../auth/infrastructure/better-auth.config';
import { WorkspaceAuthGateway } from '../workspace-auth.gateway';

const api = auth.api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const headers: IncomingHttpHeaders = { cookie: 'session=abc' };

const workspace = {
  id: 'team1',
  name: 'Engineering',
  organizationId: 'org1',
  createdAt: '2024-01-01T00:00:00.000Z',
};
const workspaceMember = {
  id: 'tm1',
  teamId: 'team1',
  userId: 'u1',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('WorkspaceAuthGateway', () => {
  let gateway: WorkspaceAuthGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new WorkspaceAuthGateway();
  });

  it('creates a workspace (team)', async () => {
    api.createTeam.mockResolvedValue(workspace);
    const result = await gateway.create(headers, {
      name: 'Engineering',
      organizationId: 'org1',
    });
    expect(result.id).toBe('team1');
    expect(api.createTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { name: 'Engineering', organizationId: 'org1' },
      }),
    );
  });

  it('updates a workspace name', async () => {
    api.updateTeam.mockResolvedValue(workspace);
    await gateway.rename(headers, 'team1', 'Platform');
    expect(api.updateTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { teamId: 'team1', data: { name: 'Platform' } },
      }),
    );
  });

  it('removes a workspace and resolves void', async () => {
    api.removeTeam.mockResolvedValue({ success: true });
    await expect(gateway.remove(headers, 'team1')).resolves.toBeUndefined();
    expect(api.removeTeam).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1' } }),
    );
  });

  describe('setActive', () => {
    it('maps the workspace when one is returned', async () => {
      api.setActiveTeam.mockResolvedValue(workspace);
      const result = await gateway.setActive(headers, 'team1');
      expect(result?.id).toBe('team1');
    });

    it('returns null when the active team is cleared', async () => {
      api.setActiveTeam.mockResolvedValue(null);
      expect(await gateway.setActive(headers, 'team1')).toBeNull();
    });
  });

  describe('listForOrganization', () => {
    it('passes the organizationId query when provided', async () => {
      api.listOrganizationTeams.mockResolvedValue([workspace]);
      const result = await gateway.listForOrganization(headers, 'org1');
      expect(result).toHaveLength(1);
      expect(api.listOrganizationTeams).toHaveBeenCalledWith(
        expect.objectContaining({ query: { organizationId: 'org1' } }),
      );
    });

    it('passes an empty query when no organizationId is provided', async () => {
      api.listOrganizationTeams.mockResolvedValue([]);
      await gateway.listForOrganization(headers);
      expect(api.listOrganizationTeams.mock.calls[0][0].query).toEqual({});
    });
  });

  // A different Better Auth method from the organization listing: nothing else
  // in the suite calls `listForCaller`.
  it('lists the caller’s own teams with their session, not an organization’s', async () => {
    api.listUserTeams.mockResolvedValue([workspace]);
    await gateway.listForCaller(headers);
    const [[call]] = api.listUserTeams.mock.calls;
    expect(call.headers.get('cookie')).toBe('session=abc');
    expect(api.listOrganizationTeams).not.toHaveBeenCalled();
  });

  it('lists workspace members', async () => {
    api.listTeamMembers.mockResolvedValue([workspaceMember]);
    const result = await gateway.listMembers(headers, 'team1');
    expect(result[0].id).toBe('tm1');
    expect(api.listTeamMembers).toHaveBeenCalledWith(
      expect.objectContaining({ query: { teamId: 'team1' } }),
    );
  });

  it('adds a workspace member', async () => {
    api.addTeamMember.mockResolvedValue(workspaceMember);
    const result = await gateway.addMember(headers, 'team1', 'u1');
    expect(result.userId).toBe('u1');
    expect(api.addTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1', userId: 'u1' } }),
    );
  });

  it('removes a workspace member and resolves void', async () => {
    api.removeTeamMember.mockResolvedValue({ success: true });
    await expect(gateway.removeMember(headers, 'team1', 'u1')).resolves.toBeUndefined();
    expect(api.removeTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1', userId: 'u1' } }),
    );
  });
});
