import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '../../../authz/domain/access-scope.types';
import { OrganizeMailCommand } from '../../../mail/commands/organize-mail/organize-mail.command';
import { TrashMailCommand } from '../../../mail/commands/trash-mail/trash-mail.command';
import { GmailConnectionEntity } from '../../../mail/domain/gmail-connection.entity';
import type { GmailLabel } from '../../../mail/infrastructure/gmail-provider.port';
import { FindGmailConnectionsQuery } from '../../../mail/queries/find-gmail-connections/find-gmail-connections.query';
import { FindMailLabelsQuery } from '../../../mail/queries/find-mail-labels/find-mail-labels.query';
import { NO_PERMISSIONS } from '../../domain/bot-tool-permission.policy';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotMailAccountsResolver } from '../bot-mail-accounts.resolver';
import { BotMailOrganizeToolsFactory } from '../bot-mail-organize-tools.factory';
import type { BotToolContext } from '../bot-tool.factory';

/**
 * Organizing as a bot's turn sees it (`product/next-steps/mail.md` §3.5):
 * marking under Approve everything runs without a card, trashing asks under
 * every preset, untrashing never asks, a label card stores the labels' ids
 * with their names on its line, more than 100 at once is refused before
 * Gmail is asked, and a thread Gmail does not have is named in the answer.
 * Gmail's own calls are the gateway's spec.
 */
const ACCOUNT = GmailConnectionEntity.connect({
  organizationId: 'org-1',
  userId: 'owner-1',
  googleSubject: 'sub-1',
  accountEmail: 'ana@gmail.test',
  label: 'Personal',
  refreshTokenSealed: Buffer.from('sealed'),
  scopes: [],
});

const LABELS: GmailLabel[] = [
  {
    id: 'INBOX',
    name: 'INBOX',
    type: 'system',
    messagesTotal: null,
    messagesUnread: null,
    threadsUnread: null,
  },
  {
    id: 'Label_7',
    name: 'Invoices',
    type: 'user',
    messagesTotal: 3,
    messagesUnread: 0,
    threadsUnread: 0,
  },
];

const signal = new AbortController().signal;

function setup(permission: BotToolContext['permission']) {
  const request = vi.fn(async () => ({ status: 'requested' as const }));
  const context: BotToolContext = {
    owner: emptyScope('owner-1', 'org-1'),
    organizationId: 'org-1',
    botId: 'bot-1',
    turnId: 'turn-1',
    homeHostId: null,
    timeZone: 'UTC',
    permission,
    permissions: NO_PERMISSIONS,
    budget: new BotTurnBudget(),
    credentialScopes: null,
    approvals: { request },
  };
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindGmailConnectionsQuery) return [ACCOUNT];
      if (query instanceof FindMailLabelsQuery) return LABELS;
      throw new Error('unexpected query');
    }),
  } as unknown as QueryBus;
  const commands = vi.fn(async (command: unknown) =>
    command instanceof TrashMailCommand || command instanceof OrganizeMailCommand
      ? { changed: ['t1'], missing: ['gone'] }
      : null,
  );
  const tools = new BotMailOrganizeToolsFactory(
    queryBus,
    { execute: commands } as unknown as CommandBus,
    new BotMailAccountsResolver(queryBus),
  ).definitions();
  const tool = (name: string) => {
    const found = tools.find((definition) => definition.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found.bind(context);
  };
  return { request, commands, tool };
}

describe('BotMailOrganizeToolsFactory', () => {
  it('marks under Approve everything without a card, and says which thread Gmail did not have', async () => {
    const { request, commands, tool } = setup('full');

    const result = await tool('mark_mail').run(
      { account: 'Personal', thread_ids: ['t1', 'gone'], read: true, starred: true },
      { signal },
    );

    expect(request).not.toHaveBeenCalled();
    expect(commands).toHaveBeenCalledWith(
      expect.objectContaining({
        threadIds: ['t1', 'gone'],
        change: { add: ['STARRED'], remove: ['UNREAD'] },
      }),
    );
    expect(result.content).toContain('1 changed');
    expect(result.content).toContain('gone');
  });

  it('asks before trashing under every preset, and never before bringing threads back', async () => {
    const { request, commands, tool } = setup('full');

    await tool('trash_mail').run({ account: 'Personal', thread_ids: ['t1'] }, { signal });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'trash_mail',
        summary: expect.stringContaining('Move 1 thread to Trash'),
      }),
    );
    expect(commands).not.toHaveBeenCalled();

    await tool('untrash_mail').run({ account: 'Personal', thread_ids: ['t1'] }, { signal });
    expect(commands).toHaveBeenCalledWith(expect.objectContaining({ trash: false }));
  });

  it('stores a label card with the labels’ ids, and names them on its line', async () => {
    const { request, tool } = setup('auto');

    await tool('label_mail').run(
      { account: 'Personal', thread_ids: ['t1'], add: ['invoices'], remove: ['INBOX'] },
      { signal },
    );

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ add: ['Label_7'], remove: ['INBOX'] }),
        summary: expect.stringContaining('put "Invoices" on and take "INBOX" off 1 thread'),
      }),
    );
  });

  it('refuses a label the account lacks before raising a card, and more than 100 threads before asking Gmail', async () => {
    const { request, commands, tool } = setup('auto');

    const unknown = await tool('label_mail').run(
      { account: 'Personal', thread_ids: ['t1'], add: ['Receipts'] },
      { signal },
    );
    const tooMany = await tool('untrash_mail').run(
      { account: 'Personal', thread_ids: Array.from({ length: 101 }, (_, i) => `t${i}`) },
      { signal },
    );

    expect(unknown.content).toContain('No label "Receipts"');
    expect(tooMany.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(commands).not.toHaveBeenCalled();
  });

  it('refuses putting Trash on mail, so trashing always goes through trash_mail’s card', async () => {
    const { request, commands, tool } = setup('full');

    const result = await tool('label_mail').run(
      { account: 'Personal', thread_ids: ['t1'], add: ['TRASH'] },
      { signal },
    );

    expect(result.content).toContain('Use trash_mail');
    expect(request).not.toHaveBeenCalled();
    expect(commands).not.toHaveBeenCalled();
  });

  it('refuses a call over the limit before a card is raised, and stores the account by its id', async () => {
    const { request, tool } = setup('auto');
    const many = (prefix: string) => Array.from({ length: 60 }, (_, i) => `${prefix}${i}`);

    const tooMany = await tool('mark_mail').run(
      { account: 'Personal', thread_ids: many('t'), message_ids: many('m'), read: true },
      { signal },
    );
    expect(tooMany.isError).toBe(true);
    expect(request).not.toHaveBeenCalled();

    await tool('archive_mail').run({ account: 'Personal', thread_ids: ['t1'] }, { signal });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ input: expect.objectContaining({ account: ACCOUNT.id }) }),
    );
  });
});
