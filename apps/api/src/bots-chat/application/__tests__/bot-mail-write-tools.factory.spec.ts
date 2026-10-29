import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { MailPlan } from '@oppenheimer/shared';
import { CreateMailDraftCommand } from '../../../mail/commands/create-mail-draft/create-mail-draft.command';
import { SendMailCommand } from '../../../mail/commands/send-mail/send-mail.command';
import { GmailConnectionEntity } from '../../../mail/domain/gmail-connection.entity';
import { FindGmailConnectionsQuery } from '../../../mail/queries/find-gmail-connections/find-gmail-connections.query';
import { PlanMailQuery } from '../../../mail/queries/plan-mail/plan-mail.query';
import { BotTurnBudget } from '../../domain/bot-turn-budget.policy';
import { BotMailAccountsResolver } from '../bot-mail-accounts.resolver';
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
  const definitions = new BotMailWriteToolsFactory(
    queryBus,
    { execute: commands } as unknown as CommandBus,
    new BotMailAccountsResolver(queryBus),
  ).definitions();
  const definition = (name: string) => {
    const found = definitions.find((tool) => tool.name === name);
    if (!found) throw new Error(`no ${name}`);
    return found;
  };
  return { context, request, commands, definition };
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
});
