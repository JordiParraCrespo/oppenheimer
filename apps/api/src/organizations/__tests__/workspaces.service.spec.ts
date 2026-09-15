import type { IncomingHttpHeaders } from 'node:http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/auth', () => ({
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

import { auth } from '../../auth/auth';
import { WorkspacesService } from '../workspaces.service';

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

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WorkspacesService();
  });

  it('creates a workspace (team)', async () => {
    api.createTeam.mockResolvedValue(workspace);
    const result = await service.create(headers, {
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
    await service.update(headers, 'team1', { name: 'Platform' });
    expect(api.updateTeam).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { teamId: 'team1', data: { name: 'Platform' } },
      }),
    );
  });

  it('removes a workspace and resolves void', async () => {
    api.removeTeam.mockResolvedValue({ success: true });
    await expect(service.remove(headers, 'team1')).resolves.toBeUndefined();
    expect(api.removeTeam).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1' } }),
    );
  });

  describe('setActive', () => {
    it('maps the workspace when one is returned', async () => {
      api.setActiveTeam.mockResolvedValue(workspace);
      const result = await service.setActive(headers, 'team1');
      expect(result?.id).toBe('team1');
    });

    it('returns null when the active team is cleared', async () => {
      api.setActiveTeam.mockResolvedValue(null);
      expect(await service.setActive(headers, 'team1')).toBeNull();
    });
  });

  describe('listForOrganization', () => {
    it('passes the organizationId query when provided', async () => {
      api.listOrganizationTeams.mockResolvedValue([workspace]);
      const result = await service.listForOrganization(headers, 'org1');
      expect(result).toHaveLength(1);
      expect(api.listOrganizationTeams).toHaveBeenCalledWith(
        expect.objectContaining({ query: { organizationId: 'org1' } }),
      );
    });

    it('passes an empty query when no organizationId is provided', async () => {
      api.listOrganizationTeams.mockResolvedValue([]);
      await service.listForOrganization(headers);
      expect(api.listOrganizationTeams.mock.calls[0][0].query).toEqual({});
    });
  });

  it('lists the caller’s workspaces', async () => {
    api.listUserTeams.mockResolvedValue([workspace]);
    const result = await service.listForCaller(headers);
    expect(result).toHaveLength(1);
  });

  it('lists workspace members', async () => {
    api.listTeamMembers.mockResolvedValue([workspaceMember]);
    const result = await service.listMembers(headers, 'team1');
    expect(result[0].id).toBe('tm1');
    expect(api.listTeamMembers).toHaveBeenCalledWith(
      expect.objectContaining({ query: { teamId: 'team1' } }),
    );
  });

  it('adds a workspace member', async () => {
    api.addTeamMember.mockResolvedValue(workspaceMember);
    const result = await service.addMember(headers, 'team1', 'u1');
    expect(result.userId).toBe('u1');
    expect(api.addTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1', userId: 'u1' } }),
    );
  });

  it('removes a workspace member and resolves void', async () => {
    api.removeTeamMember.mockResolvedValue({ success: true });
    await expect(service.removeMember(headers, 'team1', 'u1')).resolves.toBeUndefined();
    expect(api.removeTeamMember).toHaveBeenCalledWith(
      expect.objectContaining({ body: { teamId: 'team1', userId: 'u1' } }),
    );
  });
});
