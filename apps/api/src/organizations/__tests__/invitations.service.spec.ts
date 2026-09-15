import type { IncomingHttpHeaders } from 'node:http';
import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../auth/auth', () => ({
  auth: {
    api: {
      createInvitation: vi.fn(),
      acceptInvitation: vi.fn(),
      rejectInvitation: vi.fn(),
      cancelInvitation: vi.fn(),
      getInvitation: vi.fn(),
      getSession: vi.fn(),
      listInvitations: vi.fn(),
      listUserInvitations: vi.fn(),
      setActiveOrganization: vi.fn(),
    },
  },
}));

import { auth } from '../../auth/auth';
import { InvitationsService } from '../invitations.service';

const api = auth.api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const headers: IncomingHttpHeaders = { cookie: 'session=abc' };

const invitation = {
  id: 'inv1',
  organizationId: 'org1',
  email: 'invitee@x.com',
  role: 'member',
  status: 'pending',
  inviterId: 'u1',
  expiresAt: '2024-02-01T00:00:00.000Z',
  createdAt: '2024-01-01T00:00:00.000Z',
};

describe('InvitationsService', () => {
  let service: InvitationsService;
  const roles = { findOneByName: vi.fn() };
  const userRoles = { setRolesForUser: vi.fn().mockResolvedValue(undefined) };
  const invitationRecords = { findOne: vi.fn().mockResolvedValue(null) };
  const memberRecords = { exists: vi.fn().mockResolvedValue(false) };

  beforeEach(() => {
    vi.clearAllMocks();
    roles.findOneByName.mockResolvedValue(Some({ id: 'role1' }));
    service = new InvitationsService(
      roles as never,
      userRoles as never,
      invitationRecords as never,
      memberRecords as never,
    );
  });

  it('invites a member forwarding email, role and teamId', async () => {
    api.createInvitation.mockResolvedValue(invitation);
    const result = await service.invite(headers, 'org1', {
      email: 'invitee@x.com',
      role: 'member',
      teamId: 'team1',
    });
    expect(result.id).toBe('inv1');
    expect(api.createInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: 'invitee@x.com',
          role: 'member',
          organizationId: 'org1',
          teamId: 'team1',
        },
      }),
    );
  });

  it('accepts an invitation unwrapping the `{ invitation }` envelope', async () => {
    api.acceptInvitation.mockResolvedValue({ invitation, member: { userId: 'u2' } });
    const result = await service.accept(headers, 'inv1');
    expect(result.id).toBe('inv1');
    expect(api.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ body: { invitationId: 'inv1' } }),
    );
    expect(roles.findOneByName).toHaveBeenCalledWith('user', null);
    expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u2', ['role1'], 'org1');
  });

  it('grants the organization-scoped owner application role to an invited admin', async () => {
    api.acceptInvitation.mockResolvedValue({
      invitation: { ...invitation, role: 'admin' },
      member: { userId: 'u2' },
    });

    await service.accept(headers, 'inv1');

    expect(roles.findOneByName).toHaveBeenCalledWith('owner', null);
    expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u2', ['role1'], 'org1');
  });

  it('repairs and returns an already-accepted invitation for the same member', async () => {
    invitationRecords.findOne.mockResolvedValueOnce({ ...invitation, status: 'accepted' });
    api.getSession.mockResolvedValueOnce({ user: { id: 'u2', email: invitation.email } });
    memberRecords.exists.mockResolvedValueOnce(true);
    api.setActiveOrganization.mockResolvedValueOnce({ id: 'org1' });

    const result = await service.accept(headers, 'inv1');

    expect(result.status).toBe('accepted');
    expect(api.acceptInvitation).not.toHaveBeenCalled();
    expect(api.setActiveOrganization).toHaveBeenCalledWith(
      expect.objectContaining({ body: { organizationId: 'org1' } }),
    );
    expect(userRoles.setRolesForUser).toHaveBeenCalledWith('u2', ['role1'], 'org1');
  });

  it('does not recover an accepted invitation for a different account', async () => {
    invitationRecords.findOne.mockResolvedValueOnce({ ...invitation, status: 'accepted' });
    api.getSession.mockResolvedValueOnce({ user: { id: 'u3', email: 'other@x.com' } });
    api.acceptInvitation.mockResolvedValueOnce({ invitation, member: { userId: 'u3' } });

    await service.accept(headers, 'inv1');

    expect(api.setActiveOrganization).not.toHaveBeenCalled();
    expect(api.acceptInvitation).toHaveBeenCalled();
  });

  it('fails visibly when a required system role is missing', async () => {
    api.acceptInvitation.mockResolvedValue({ invitation, member: { userId: 'u2' } });
    roles.findOneByName.mockResolvedValueOnce(None);

    await expect(service.accept(headers, 'inv1')).rejects.toThrow(
      'Required system role "user" is missing',
    );
    expect(userRoles.setRolesForUser).not.toHaveBeenCalled();
  });

  it('rejects an invitation unwrapping the `{ invitation }` envelope', async () => {
    api.rejectInvitation.mockResolvedValue({ invitation });
    const result = await service.reject(headers, 'inv1');
    expect(result.id).toBe('inv1');
  });

  it('cancels an invitation (bare result, no envelope)', async () => {
    api.cancelInvitation.mockResolvedValue(invitation);
    const result = await service.cancel(headers, 'inv1');
    expect(result.status).toBe('pending');
  });

  it('gets an invitation by id via the query param', async () => {
    api.getInvitation.mockResolvedValue(invitation);
    await service.get(headers, 'inv1');
    expect(api.getInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ query: { id: 'inv1' } }),
    );
  });

  it('lists invitations for an organization', async () => {
    api.listInvitations.mockResolvedValue([invitation, invitation]);
    const result = await service.listForOrganization(headers, 'org1');
    expect(result).toHaveLength(2);
    expect(api.listInvitations).toHaveBeenCalledWith(
      expect.objectContaining({ query: { organizationId: 'org1' } }),
    );
  });

  it('lists invitations for the caller', async () => {
    api.listUserInvitations.mockResolvedValue([invitation]);
    const result = await service.listForCaller(headers);
    expect(result).toHaveLength(1);
  });
});
