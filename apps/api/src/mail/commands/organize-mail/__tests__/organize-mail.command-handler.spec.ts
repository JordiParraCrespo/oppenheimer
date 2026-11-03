import { emptyScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import type { GmailCallResolver } from '../../../application/gmail-call.resolver';
import { MailErrors } from '../../../domain/mail.errors';
import type { GmailProviderPort } from '../../../infrastructure/gmail-provider.port';
import { OrganizeMailCommand } from '../organize-mail.command';
import { OrganizeMailCommandHandler } from '../organize-mail.command-handler';

/**
 * Organizing threads and messages is two kinds of write to Gmail: the threads
 * one by one, then the messages in one batch. What a bot is told it changed
 * must be what did change when Gmail's limit lands between the two.
 */
const resetAt = new Date('2026-11-02T10:01:00.000Z');
const limited = new AppError(MailErrors.GMAIL_RATE_LIMITED, {
  retryAfterSeconds: 60,
  extensions: { upstream: 'Gmail', retryAfterSeconds: 60, resetAt: resetAt.toISOString() },
});

function setup(provider: Pick<GmailProviderPort, 'modifyThreads' | 'modifyMessages'>) {
  const gmail = {
    activeConnection: vi.fn(async () => ({ id: 'c-1' })),
    call: vi.fn(async (_connection, work) => work(provider, { connectionId: 'c-1' })),
  } as unknown as GmailCallResolver;
  const handler = new OrganizeMailCommandHandler(gmail);
  const command = new OrganizeMailCommand({
    scope: emptyScope('user-1', 'org-1'),
    connectionId: 'c-1',
    threadIds: ['t1', 't2'],
    messageIds: ['m1'],
    change: { add: [], remove: ['INBOX'] },
  });
  return { handler, command };
}

describe('OrganizeMailCommandHandler', () => {
  // What breaks this: the threads archived, then the bot told "nothing was
  // done" because the message batch met the limit, and archiving them again.
  it('answers the threads it changed when the limit stops the message batch after them', async () => {
    const { handler, command } = setup({
      modifyThreads: vi.fn(async () => ({
        changed: ['t1', 't2'],
        missing: [],
        notReached: [],
        limited: null,
      })),
      modifyMessages: vi.fn(async () => {
        throw limited;
      }),
    });

    await expect(handler.execute(command)).resolves.toEqual({
      changed: ['t1', 't2'],
      missing: [],
      notReached: ['m1'],
      limited: { system: 'Gmail', resetAt },
    });
  });

  it('answers the limit itself when nothing changed before it', async () => {
    const { handler, command } = setup({
      modifyThreads: vi.fn(async () => ({
        changed: [],
        missing: ['t1', 't2'],
        notReached: [],
        limited: null,
      })),
      modifyMessages: vi.fn(async () => {
        throw limited;
      }),
    });

    await expect(handler.execute(command)).rejects.toMatchObject({ code: 'MAIL_008' });
  });
});
