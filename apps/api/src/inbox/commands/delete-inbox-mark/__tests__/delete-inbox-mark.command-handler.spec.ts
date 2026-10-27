import { None, Some } from 'oxide.ts';
import type { InboxMarkRepositoryPort } from '../../../database/inbox-mark.repository.port';
import { InboxMarkEntity } from '../../../domain/inbox-mark.entity';
import { DeleteInboxMarkCommand } from '../delete-inbox-mark.command';
import { DeleteInboxMarkCommandHandler } from '../delete-inbox-mark.command-handler';

/**
 * DELETE /inbox/marks/:itemKey is Bring back and Restore priority: the
 * caller's own mark goes, with its event; no mark is already as asked, and
 * nothing is written or announced.
 */
function setup(found: InboxMarkEntity | null) {
  const marks: Pick<InboxMarkRepositoryPort, 'findOne' | 'delete'> = {
    findOne: vi.fn(async () => (found ? Some(found) : None)),
    delete: vi.fn(async () => true),
  };
  return { marks, handler: new DeleteInboxMarkCommandHandler(marks as InboxMarkRepositoryPort) };
}

const command = (overrides: Partial<{ organizationId: string | null; itemKey: string }> = {}) =>
  new DeleteInboxMarkCommand({
    organizationId: 'org-1',
    userId: 'user-1',
    itemKey: 'run:r-1',
    ...overrides,
  });

describe('DeleteInboxMarkCommandHandler', () => {
  it("removes the caller's mark, announcing it", async () => {
    const mark = InboxMarkEntity.create({
      id: 'm-1',
      props: {
        organizationId: 'org-1',
        userId: 'user-1',
        itemKey: 'run:r-1',
        mark: 'low',
        until: null,
      },
    });
    const { marks, handler } = setup(mark);
    await handler.execute(command());
    expect(marks.findOne).toHaveBeenCalledWith('org-1', 'user-1', 'run:r-1');
    expect(marks.delete).toHaveBeenCalledWith(mark);
    expect(mark.domainEvents).toHaveLength(1);
  });

  it('succeeds with nothing to remove, and writes nothing', async () => {
    const { marks, handler } = setup(null);
    await expect(handler.execute(command())).resolves.toBeUndefined();
    expect(marks.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['INBOX_001', { organizationId: null }],
    ['INBOX_002', { itemKey: 'run' }],
  ])('refuses with %s before reading anything', async (code, overrides) => {
    const { marks, handler } = setup(null);
    await expect(handler.execute(command(overrides))).rejects.toMatchObject({ code });
    expect(marks.findOne).not.toHaveBeenCalled();
  });
});
