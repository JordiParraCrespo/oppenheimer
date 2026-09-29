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
  const organizations = { setActive: vi.fn(), leave: vi.fn() };
  const invitations = { findOneById: vi.fn() };
  const workspaces = { isMember: vi.fn() };
  const grant = vi.fn();
  // Behaves as `MembershipAccessPolicy.admit` does: write, grant, undo on failure.
  const membershipAccess = {
    admit: vi.fn(async (write: () => Promise<unknown>, undo: (e: unknown) => Promise<unknown>) => {
      const entry = await write();
      try {
        await grant(entry);
      } catch (error) {
        await undo(entry);
        throw error;
      }
      return entry;
    }),
  };
  let handler: AcceptInvitationCommandHandler;

  const accept = (caller: { id: string; email: string } | null) =>
    handler.execute(new AcceptInvitationCommand({ headers, invitationId: 'inv1', caller }));

  beforeEach(() => {
    vi.clearAllMocks();
    invitations.findOneById.mockResolvedValue(None);
    workspaces.isMember.mockResolvedValue(false);
    grant.mockResolvedValue(undefined);
    handler = new AcceptInvitationCommandHandler(
      invitationAuth as never,
      organizations as never,
      invitations as never,
      workspaces as never,
      membershipAccess as never,
    );
  });

  it('accepts through Better Auth, grants the role the invitation carries, answers its id', async () => {
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u2' });

    expect(await accept(null)).toBe('inv1');
    expect(invitationAuth.accept).toHaveBeenCalledWith(headers, 'inv1');
    expect(grant).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u2', organizationId: 'org1', role: 'member' }),
    );
  });

  it('passes an invited admin’s organization role for the policy to scope', async () => {
    invitationAuth.accept.mockResolvedValue({
      invitation: { ...invitation, role: 'admin' },
      userId: 'u2',
    });

    await accept(null);

    expect(grant).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }));
  });

  // Not a membership the UI did not expect plus a 4xx: the caller leaves again.
  it('leaves the organization when the role that opens it cannot be granted', async () => {
    invitationAuth.accept.mockResolvedValue({ invitation, userId: 'u2' });
    grant.mockRejectedValue(Object.assign(new Error('x'), { code: 'ROLE_007' }));

    await expect(accept(null)).rejects.toMatchObject({ code: 'ROLE_007' });
    expect(organizations.leave).toHaveBeenCalledWith(headers, 'org1');
  });

  it('finishes an already-accepted invitation for the same member', async () => {
    invitations.findOneById.mockResolvedValue(Some({ ...invitation, status: 'accepted' }));
    workspaces.isMember.mockResolvedValue(true);

    expect(await accept({ id: 'u2', email: 'INVITEE@x.com' })).toBe('inv1');
    expect(invitationAuth.accept).not.toHaveBeenCalled();
    expect(organizations.setActive).toHaveBeenCalledWith(headers, 'org1');
    expect(grant).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u2' }));
  });

  it('does not leave a membership that predates the request', async () => {
    invitations.findOneById.mockResolvedValue(Some({ ...invitation, status: 'accepted' }));
    workspaces.isMember.mockResolvedValue(true);
    grant.mockRejectedValue(new Error('grant failed'));

    await expect(accept({ id: 'u2', email: invitation.email })).rejects.toThrow('grant failed');
    expect(organizations.leave).not.toHaveBeenCalled();
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
});
