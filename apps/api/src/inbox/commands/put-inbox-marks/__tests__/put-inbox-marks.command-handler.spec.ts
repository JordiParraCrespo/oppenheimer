import type { InboxMarkRepositoryPort } from '../../../database/inbox-mark.repository.port';
import type { InboxMarkEntity } from '../../../domain/inbox-mark.entity';
import { PutInboxMarksCommand } from '../put-inbox-marks.command';
import { PutInboxMarksCommandHandler } from '../put-inbox-marks.command-handler';

/**
 * POST /inbox/marks/batch, a bulk action from the Inbox: one request marks a
 * whole selection (the console once sent one per row and hit the hundred a
 * minute rate limit on a large Inbox). A refusal for any key writes none of
 * them, and the marks are stored in one transaction (the repository's
 * `upsertAll` and `clear`), so a selection is never left half marked.
 */
function setup() {
  const marks = {
    upsertAll: vi.fn(async (_marks: InboxMarkEntity[]) => undefined),
    clear: vi.fn(async (_organizationId: string, _userId: string, keys: string[]) => keys.length),
  };
  return {
    marks,
    handler: new PutInboxMarksCommandHandler(marks as unknown as InboxMarkRepositoryPort),
  };
}

function command(overrides: Partial<ConstructorParameters<typeof PutInboxMarksCommand>[0]> = {}) {
  return new PutInboxMarksCommand({
    organizationId: 'org-1',
    userId: 'user-1',
    itemKeys: ['approval:ap-1', 'run:r-1'],
    mark: 'done',
    until: null,
    ...overrides,
  });
}

describe('PutInboxMarksCommandHandler', () => {
  it('stores the same mark on every occurrence, each with its event', async () => {
    const { marks, handler } = setup();
    await handler.execute(command({ itemKeys: ['run:r-1', 'approval:ap-1', 'run:r-1'] }));
    expect(marks.upsertAll).toHaveBeenCalledTimes(1);
    const stored = marks.upsertAll.mock.calls[0][0];
    expect(stored.map((mark) => [mark.itemKey, mark.mark])).toEqual([
      ['approval:ap-1', 'done'],
      ['run:r-1', 'done'],
    ]);
    expect(stored.every((mark) => mark.domainEvents.length === 1)).toBe(true);
  });

  it("clears the caller's marks on every occurrence when the mark is null", async () => {
    const { marks, handler } = setup();
    await handler.execute(command({ mark: null }));
    expect(marks.clear).toHaveBeenCalledWith('org-1', 'user-1', ['approval:ap-1', 'run:r-1']);
    expect(marks.upsertAll).not.toHaveBeenCalled();
  });

  it.each([
    ['TENANT_001', 'a request in no workspace', { organizationId: null }],
    ['INBOX_002', 'one key no occurrence has', { itemKeys: ['run:r-1', 'not/a key'] }],
    ['INBOX_002', 'one bad key while clearing', { mark: null, itemKeys: ['run:r-1', 'nope'] }],
    [
      'INBOX_003',
      'a snooze that has already ended',
      { mark: 'snoozed' as const, until: new Date(Date.now() - 1000) },
    ],
  ])('refuses with %s for %s, and writes none of them', async (code, _, overrides) => {
    const { marks, handler } = setup();
    await expect(handler.execute(command(overrides))).rejects.toMatchObject({ code });
    expect(marks.upsertAll).not.toHaveBeenCalled();
    expect(marks.clear).not.toHaveBeenCalled();
  });
});
