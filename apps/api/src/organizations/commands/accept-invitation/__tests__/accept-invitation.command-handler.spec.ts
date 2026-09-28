import { None, Some } from 'oxide.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitationCommand } from '../accept-invitation.command';
import { AcceptInvitationCommandHandler } from '../accept-invitation.command-handler';

const headers = { cookie: 'session=abc' };
const invitation = {
  id: 'inv1',
  organizationId: 'org1',
  email: 'invitee@x.com',
  role: 'member',
  status: 'pending',
  teamId: null,
  inviterId: 'u1',
  expiresAt: new Date('2024-02-01T00:00:00.000Z'),
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
};

describe('AcceptInvitationCommandHandler', () => {
  const invitationAuth = { accept: vi.fn() };
  const organizations = { setActive: vi.fn() };
  const invitations = { findOneById: vi.fn() };
  const workspaces = { isMember: vi.fn() };
  const membershipAccess = { grant: vi.fn() };
  let handler: AcceptInvitationCommandHandler;

  const accept = (caller: { id: string; email: string } | null) =>
    handler.execute(new AcceptInvitationCommand({ headers, invitationId: 'inv1', caller }));

  beforeEach(() => {
    vi.clearAllMocks();
    invitations.findOneById.mockResolvedValue(None);
    workspaces.isMember.mockResolvedValue(false);
    membershipAccess.grant.mockResolvedValue(undefined);
    handler = new AcceptInvitationCommandHandler(
      invitationAuth as never,
      organizations as never,
      invitations as never,
      workspaces as never,
      membershipAccess as never,
    );
  });

  it('accepts through Better Auth and grants the role the invitation carries', async () => {
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u2' });

    const result = await accept(null);

    expect(result.id).toBe('inv1');
    expect(invitationAuth.accept).toHaveBeenCalledWith(headers, 'inv1');
    expect(membershipAccess.grant).toHaveBeenCalledWith('u2', 'org1', 'member');
  });

  it('grants an invited admin their organization role, which the policy scopes', async () => {
    invitationAuth.accept.mockResolvedValue({
      invitation: { ...invitation, role: 'admin' },
      userId: 'u2',
    });

    await accept(null);

    expect(membershipAccess.grant).toHaveBeenCalledWith('u2', 'org1', 'admin');
  });

  it('repairs and returns an already-accepted invitation for the same member', async () => {
    invitations.findOneById.mockResolvedValue(Some({ ...invitation, status: 'accepted' }));
    workspaces.isMember.mockResolvedValue(true);

    const result = await accept({ id: 'u2', email: 'INVITEE@x.com' });

    expect(result.status).toBe('accepted');
    expect(invitationAuth.accept).not.toHaveBeenCalled();
    expect(organizations.setActive).toHaveBeenCalledWith(headers, 'org1');
    expect(membershipAccess.grant).toHaveBeenCalledWith('u2', 'org1', 'member');
  });

  it('does not recover an accepted invitation for a different account', async () => {
    invitations.findOneById.mockResolvedValue(Some({ ...invitation, status: 'accepted' }));
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u3' });

    await accept({ id: 'u3', email: 'other@x.com' });

    expect(organizations.setActive).not.toHaveBeenCalled();
    expect(invitationAuth.accept).toHaveBeenCalled();
  });

  it('does not recover an accepted invitation that made no membership', async () => {
    invitations.findOneById.mockResolvedValue(Some({ ...invitation, status: 'accepted' }));
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u2' });

    await accept({ id: 'u2', email: invitation.email });

    expect(workspaces.isMember).toHaveBeenCalledWith('org1', 'u2');
    expect(invitationAuth.accept).toHaveBeenCalled();
  });

  it('fails visibly when the grant fails', async () => {
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u2' });
    membershipAccess.grant.mockRejectedValue(Object.assign(new Error('x'), { code: 'ROLE_007' }));

    await expect(accept(null)).rejects.toMatchObject({ code: 'ROLE_007' });
  });
});
