import type { InboxMarkRepositoryPort } from '../../../database/inbox-mark.repository.port';
import type { InboxMarkEntity } from '../../../domain/inbox-mark.entity';
import { PutInboxMarkCommand } from '../put-inbox-mark.command';
import { PutInboxMarkCommandHandler } from '../put-inbox-mark.command-handler';

/**
 * PUT /inbox/marks/:itemKey: the caller's mark on the occurrence, in their
 * workspace, stored with its event. Each refusal is a catalog code and
 * writes nothing.
 */
function setup() {
  const marks: Pick<InboxMarkRepositoryPort, 'upsert'> = { upsert: vi.fn(async () => undefined) };
  return { marks, handler: new PutInboxMarkCommandHandler(marks as InboxMarkRepositoryPort) };
}

function command(overrides: Partial<ConstructorParameters<typeof PutInboxMarkCommand>[0]> = {}) {
  return new PutInboxMarkCommand({
    organizationId: 'org-1',
    userId: 'user-1',
    itemKey: 'approval:ap-1',
    mark: 'done',
    until: null,
    ...overrides,
  });
}

describe('PutInboxMarkCommandHandler', () => {
  it("stores the caller's mark in the request's workspace, with its event", async () => {
    const { marks, handler } = setup();
    await expect(handler.execute(command({ mark: 'low' }))).resolves.toBe('approval:ap-1');
    const stored = vi.mocked(marks.upsert).mock.calls[0][0] as InboxMarkEntity;
    expect(stored).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      itemKey: 'approval:ap-1',
      mark: 'low',
      until: null,
    });
    expect(stored.domainEvents).toHaveLength(1);
  });

  it('stores a snooze that ends in the future', async () => {
    const { marks, handler } = setup();
    const until = new Date(Date.now() + 60 * 60_000);
    await handler.execute(command({ mark: 'snoozed', until }));
    expect(vi.mocked(marks.upsert).mock.calls[0][0]).toMatchObject({ mark: 'snoozed', until });
  });

  it.each([
    ['TENANT_001', 'a request in no workspace', { organizationId: null }],
    ['INBOX_002', 'a key no occurrence has', { itemKey: 'not/a key' }],
    [
      'INBOX_003',
      'a snooze that has already ended',
      { mark: 'snoozed' as const, until: new Date(Date.now() - 1000) },
    ],
  ])('refuses with %s %s, and writes nothing', async (code, _, overrides) => {
    const { marks, handler } = setup();
    await expect(handler.execute(command(overrides))).rejects.toMatchObject({ code });
    expect(marks.upsert).not.toHaveBeenCalled();
  });
});
