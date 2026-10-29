import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { MailPlan } from '@oppenheimer/shared';
import { CreateMailDraftCommand } from '../../../mail/commands/create-mail-draft/create-mail-draft.command';
import { ScheduleMailCommand } from '../../../mail/commands/schedule-mail/schedule-mail.command';
import { SendMailCommand } from '../../../mail/commands/send-mail/send-mail.command';
import { GmailConnectionEntity } from '../../../mail/domain/gmail-connection.entity';
import { FindGmailConnectionsQuery } from '../../../mail/queries/find-gmail-connections/find-gmail-connections.query';
import { PlanMailQuery } from '../../../mail/queries/plan-mail/plan-mail.query';
import type { BotAttachmentRepositoryPort } from '../../database/bot-attachment.repository.port';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import type { BotAttachmentFilesPort } from '../../infrastructure/bot-attachment-files.port';
import { BotMailAccountsResolver } from '../bot-mail-accounts.resolver';
import { BotMailChatFilesResolver } from '../bot-mail-chat-files.resolver';
import { BotMailWriteToolsFactory } from '../bot-mail-write-tools.factory';
import type { ApprovedCallContext, BotToolContext } from '../bot-tool.factory';

/**
 * The mail writes as a bot's turn sees them (`product/next-steps/mail.md`
 * §3.3–3.4): a draft is written without asking, a send asks under every
 * preset (Approve everything included) with the planned message stored on
 * the card, and a yes sends exactly that plan once, under its approval; a
 * send carried out with no stored plan, or outside an approval, is refused.
 * What the plan and the send do with Gmail is the mail module's spec.
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

const PLAN: MailPlan = {
  kind: 'new',
  connectionId: ACCOUNT.id,
  accountEmail: 'ana@gmail.test',
  from: { email: 'ana@gmail.test', name: 'Ana' },
  to: ['bo@client.test'],
  cc: [],
  bcc: [],
  recipientsFromMail: false,
  subject: 'Invoice 42',
  body: 'Paid',
  signature: true,
  original: null,
  threadId: null,
  attachments: [],
  draftId: null,
  draftMessageId: null,
};

const signal = new AbortController().signal;

const RECEIPT = {
  id: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10',
  name: 'receipt.png',
  mimeType: 'image/png',
  sizeBytes: 3,
  storageKey: 'bot-attachments/org-1/bot-1/receipt.png',
};

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
    budget: new BotTurnBudget(),
    credentialScopes: null,
    approvals: { request },
  };
  const queryBus = {
    execute: vi.fn(async (query: unknown) => {
      if (query instanceof FindGmailConnectionsQuery) return [ACCOUNT];
      if (query instanceof PlanMailQuery) return PLAN;
      throw new Error('unexpected query');
    }),
  } as unknown as QueryBus;
  const commands = vi.fn(async (command: unknown) => {
    if (command instanceof CreateMailDraftCommand) {
      return { draftId: 'd1', messageId: 'dm1', threadId: 't1' };
    }
    return 'send-1';
  });
  const images = {
    findManyForBot: vi.fn(async (_org: string, _bot: string, ids: readonly string[]) =>
      ids.includes(RECEIPT.id) ? [RECEIPT] : [],
    ),
  } as unknown as BotAttachmentRepositoryPort;
  const files = {
    read: vi.fn(async () => Buffer.from('png')),
  } as unknown as BotAttachmentFilesPort;
  const definitions = new BotMailWriteToolsFactory(
    queryBus,
    { execute: commands } as unknown as CommandBus,
    new BotMailAccountsResolver(queryBus),
    new BotMailChatFilesResolver(images, files),
  ).definitions();
  const definition = (name: string) => {
    const found = definitions.find((tool) => tool.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  return { context, request, commands, definition, queryBus };
}

const SEND = { account: 'Personal', to: ['bo@client.test'], subject: 'Invoice 42', body: 'Paid' };

describe('BotMailWriteToolsFactory', () => {
  it('saves a draft without asking, and answers its id and where it opens', async () => {
    const { context, request, commands, definition } = setup('auto');

    const result = await definition('create_draft').bind(context).run(SEND, { signal });

    expect(request).not.toHaveBeenCalled();
    expect(commands).toHaveBeenCalledWith(expect.any(CreateMailDraftCommand));
    expect(result.content).toContain('draft id d1');
    expect(result.content).toContain('nothing was sent');
  });

  it('asks before sending even under Approve everything, storing the planned message on the card', async () => {
    const { context, request, commands, definition } = setup('full');

    await definition('send_mail').bind(context).run(SEND, { signal });

    expect(commands).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'send_mail',
        input: expect.objectContaining({ plan: PLAN }),
        summary: 'Send from ana@gmail.test to bo@client.test: "Invoice 42"',
      }),
    );
  });

  it('sends the stored plan once approved, under the approval’s id', async () => {
    const { context, commands, definition } = setup('full');

    const result = await definition('send_mail').runApproved(
      { ...SEND, plan: PLAN },
      { ...context, approvalId: 'approval-1' },
      signal,
    );

    expect(result.isError).toBe(false);
    const [command] = commands.mock.calls[0];
    expect(command).toBeInstanceOf(SendMailCommand);
    expect(command).toMatchObject({ approvalId: 'approval-1', plan: PLAN, botId: 'bot-1' });
  });

  it('refuses a send with no stored plan, or outside an approval, and sends nothing', async () => {
    const { context, commands, definition } = setup('full');

    const unplanned = await definition('send_mail').runApproved(
      { ...SEND, plan: { subject: 'forged' } },
      { ...context, approvalId: 'approval-1' },
      signal,
    );
    const unapproved = await definition('send_mail').runApproved(
      { ...SEND, plan: PLAN },
      context as unknown as ApprovedCallContext,
      signal,
    );

    expect(unplanned.isError).toBe(true);
    expect(unapproved.isError).toBe(true);
    expect(commands).not.toHaveBeenCalled();
  });

  it('answers a saved draft with a card for the chat: the message, its id and where it opens', async () => {
    const { context, definition } = setup('auto');

    const result = await definition('create_draft').bind(context).run(SEND, { signal });

    expect(JSON.parse(String(result.data?.mailDraft))).toEqual({
      saved: 'created',
      draftId: 'd1',
      link: expect.stringContaining('#drafts?compose=dm1'),
      mail: PLAN,
    });
  });

  it('attaches an image from this chat by its id, and refuses one the bot does not have', async () => {
    const { context, commands, definition, queryBus } = setup('auto');

    await definition('create_draft')
      .bind(context)
      .run({ ...SEND, attachments: [{ chat_image: RECEIPT.id }] }, { signal });
    const planned = vi
      .mocked(queryBus.execute)
      .mock.calls.find(([query]) => query instanceof PlanMailQuery)?.[0] as PlanMailQuery;
    expect(planned.request.localFiles).toEqual([
      {
        source: 'chat',
        attachmentId: RECEIPT.id,
        filename: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: 3,
      },
    ]);

    const refused = await definition('create_draft')
      .bind(context)
      .run(
        { ...SEND, attachments: [{ chat_image: '00000000-0000-4000-8000-000000000000' }] },
        { signal },
      );
    expect(refused.isError).toBe(true);
    expect(commands).toHaveBeenCalledTimes(1);
  });

  it('reads a planned chat image’s bytes when the mail is sent', async () => {
    const { context, commands, definition } = setup('full');
    const image = {
      source: 'chat' as const,
      attachmentId: RECEIPT.id,
      filename: 'receipt.png',
      mimeType: 'image/png',
      sizeBytes: 3,
    };

    await definition('send_mail').runApproved(
      { ...SEND, plan: { ...PLAN, attachments: [image] } },
      { ...context, approvalId: 'approval-1' },
      signal,
    );

    const [command] = commands.mock.calls[0] as [SendMailCommand];
    expect(command.localFiles.get(`chat:${RECEIPT.id}`)).toEqual(Buffer.from('png'));
  });

  it('asks before scheduling under every preset, the time on the card, and schedules the stored plan once approved', async () => {
    const { context, request, commands, definition } = setup('full');
    const sendAt = '2030-01-07T09:00:00+01:00';

    await definition('schedule_mail')
      .bind(context)
      .run({ ...SEND, send_at: sendAt }, { signal });
    expect(commands).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'schedule_mail',
        input: expect.objectContaining({ plan: PLAN, send_at: sendAt }),
        summary: expect.stringMatching(/^At .*2030.*: Send from ana@gmail.test/),
      }),
    );

    await definition('schedule_mail').runApproved(
      { ...SEND, send_at: sendAt, plan: PLAN },
      { ...context, approvalId: 'approval-1' },
      signal,
    );
    const [command] = commands.mock.calls[0] as [ScheduleMailCommand];
    expect(command).toBeInstanceOf(ScheduleMailCommand);
    expect(command).toMatchObject({ approvalId: 'approval-1', plan: PLAN });
    expect(command.sendAt.toISOString()).toBe('2030-01-07T08:00:00.000Z');
  });
});
