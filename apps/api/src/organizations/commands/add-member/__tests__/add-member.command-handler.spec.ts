import { describe, expect, it, vi } from 'vitest';
import { AddMemberCommand } from '../add-member.command';
import { AddMemberCommandHandler } from '../add-member.command-handler';

describe('AddMemberCommandHandler', () => {
  const headers = { cookie: 'session=abc' };
  const member = { id: 'm1', organizationId: 'org1', userId: 'u1', role: 'member', user: null };
  const input = { userId: 'u1', role: 'member' as const, teamId: 'team1' };

  function handlerWith(admit: (write: () => unknown, undo: (e: unknown) => unknown) => unknown) {
    const organizations = {
      addMember: vi.fn().mockResolvedValue(member),
      removeMember: vi.fn().mockResolvedValue(member),
    };
    const handler = new AddMemberCommandHandler(organizations as never, { admit } as never);
    return { handler, organizations };
  }

  it('adds the member through the policy and answers the member id', async () => {
    const { handler, organizations } = handlerWith(async (write) => write());

    const id = await handler.execute(
      new AddMemberCommand({ headers, organizationId: 'org1', input }),
    );

    expect(id).toBe('m1');
    expect(organizations.addMember).toHaveBeenCalledWith(headers, 'org1', input);
  });

  it('takes the member back off the roster as the undo', async () => {
    const { handler, organizations } = handlerWith(async (write, undo) => {
      const entry = await write();
      await undo(entry);
      throw new Error('grant failed');
    });

    await expect(
      handler.execute(new AddMemberCommand({ headers, organizationId: 'org1', input })),
    ).rejects.toThrow('grant failed');
    expect(organizations.removeMember).toHaveBeenCalledWith(headers, 'org1', 'm1');
  });
});
