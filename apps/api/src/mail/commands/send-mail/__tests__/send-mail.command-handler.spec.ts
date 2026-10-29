import { emptyScope } from '@oppenheimer/backend-authz';
import type { MailPlan } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import type { GmailCallResolver } from '../../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../../application/mail-compose.resolver';
import type { MailSendRepositoryPort } from '../../../database/mail-send.repository.port';
import { GmailConnectionEntity } from '../../../domain/gmail-connection.entity';
import { MailSendEntity } from '../../../domain/mail-send.entity';
import type { GmailProviderPort } from '../../../infrastructure/gmail-provider.port';
import { SendMailCommand } from '../send-mail.command';
import { SendMailCommandHandler } from '../send-mail.command-handler';

/**
 * An approved send goes out once (`product/next-steps/mail.md` §3.4): claimed
 * under the approval before Gmail is asked, so a retry answers the same send
 * or refuses one that may have gone (`MAIL_015`); the day's cap, counted in
 * the claim's own locked step, refuses before Gmail is asked (`MAIL_011`); a
 * draft edited since the card is not sent (`MAIL_014`); and a send Gmail
 * refused is recorded as failed. The claim's uniqueness and the cap under a
 * race are the integration suite's.
 */
const CONNECTION = GmailConnectionEntity.connect({
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
  connectionId: CONNECTION.id,
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

const DRAFT_PLAN: MailPlan = { ...PLAN, kind: 'draft', draftId: 'd1', draftMessageId: 'dm1' };

function claimed(status: 'sending' | 'sent' | 'failed'): MailSendEntity {
  const send = MailSendEntity.claim({
    organizationId: 'org-1',
    userId: 'owner-1',
    connectionId: CONNECTION.id,
    botId: 'bot-1',
    approvalId: 'approval-1',
    kind: 'new',
    accountEmail: 'ana@gmail.test',
    recipients: ['bo@client.test'],
    subject: 'Invoice 42',
  });
  if (status === 'sent') send.sent('g1', 't1', new Date());
  if (status === 'failed') send.failed(new Date());
  return send;
}

function setup(
  options: { prior?: MailSendEntity; sentToday?: number; draftMessageId?: string } = {},
) {
  const provider = {
    sendMessage: vi.fn(async () => ({ messageId: 'g1', threadId: 't1' })),
    sendDraft: vi.fn(async () => ({ messageId: 'g2', threadId: 't2' })),
    readDraft: vi.fn(async () => ({
      id: 'd1',
      message: { id: options.draftMessageId ?? 'dm1' },
    })),
  };
  const sends = {
    findByApproval: vi.fn(async () => (options.prior ? Some(options.prior) : None)),
    claim: vi.fn(),
    claimUnderCap: vi.fn(async (_send: MailSendEntity, _since: Date, cap: number) =>
      (options.sentToday ?? 0) >= cap
        ? { outcome: 'over_cap' as const, sentInWindow: options.sentToday ?? 0 }
        : { outcome: 'claimed' as const },
    ),
    save: vi.fn(async () => undefined),
    countSince: vi.fn(async () => options.sentToday ?? 0),
    findRecentOwn: vi.fn(),
    findDue: vi.fn(),
    claimDueUnderCap: vi.fn(),
    cancelOwn: vi.fn(),
    findScheduledOwn: vi.fn(),
  } satisfies MailSendRepositoryPort;
  const gmail = {
    activeConnection: vi.fn(async () => CONNECTION),
    call: async <T>(_c: unknown, run: (p: GmailProviderPort, g: unknown) => Promise<T>) =>
      run(provider as unknown as GmailProviderPort, {}),
  } as unknown as GmailCallResolver;
  // The real send step, over a stubbed build: the draft check is the resolver's.
  const compose = new MailComposeResolver(gmail);
  vi.spyOn(compose, 'build').mockResolvedValue({ raw: Buffer.from('mime'), threadId: null });
  const handler = new SendMailCommandHandler(gmail, compose, sends);
  const send = (plan: MailPlan = PLAN) =>
    handler.execute(
      new SendMailCommand({
        scope: emptyScope('owner-1', 'org-1'),
        plan,
        approvalId: 'approval-1',
        botId: 'bot-1',
        localFiles: new Map(),
      }),
    );
  return { send, sends, provider };
}

describe('SendMailCommandHandler', () => {
  it('claims the approval, sends the built message and records Gmail’s ids', async () => {
    const { send, sends, provider } = setup();

    const id = await send();

    expect(provider.sendMessage).toHaveBeenCalledOnce();
    const [claim] = sends.claimUnderCap.mock.calls[0];
    expect(claim.id).toBe(id);
    expect(sends.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', gmailMessageId: 'g1' }),
    );
  });

  it('answers a retried approval with the same send, and never sends it again', async () => {
    const prior = claimed('sent');
    const { send, sends, provider } = setup({ prior });

    await expect(send()).resolves.toBe(prior.id);

    expect(provider.sendMessage).not.toHaveBeenCalled();
    expect(sends.claimUnderCap).not.toHaveBeenCalled();
  });

  it('refuses with MAIL_015 a send that was started and never confirmed, or failed', async () => {
    for (const status of ['sending', 'failed'] as const) {
      const { send, provider } = setup({ prior: claimed(status) });

      await expect(send()).rejects.toMatchObject({ code: 'MAIL_015' });
      expect(provider.sendMessage).not.toHaveBeenCalled();
    }
  });

  it('refuses with MAIL_011 when the locked claim finds the day’s fifty sent', async () => {
    const { send, sends, provider } = setup({ sentToday: 50 });

    await expect(send()).rejects.toMatchObject({ code: 'MAIL_011' });

    expect(sends.claimUnderCap).toHaveBeenCalledWith(expect.anything(), expect.any(Date), 50);
    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses with MAIL_015 when another attempt claimed the approval first', async () => {
    const { send, sends, provider } = setup();
    sends.claimUnderCap.mockResolvedValueOnce({ outcome: 'taken' });
    sends.findByApproval
      .mockResolvedValueOnce(None)
      .mockResolvedValueOnce(Some(claimed('sending')));

    await expect(send()).rejects.toMatchObject({ code: 'MAIL_015' });

    expect(provider.sendMessage).not.toHaveBeenCalled();
  });

  it('sends a draft only while it is the version the card showed', async () => {
    const unchanged = setup();
    await unchanged.send(DRAFT_PLAN);
    expect(unchanged.provider.sendDraft).toHaveBeenCalledWith(expect.anything(), 'd1');

    const edited = setup({ draftMessageId: 'dm2' });
    await expect(edited.send(DRAFT_PLAN)).rejects.toMatchObject({ code: 'MAIL_014' });
    expect(edited.provider.sendDraft).not.toHaveBeenCalled();
    expect(edited.sends.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });

  it('records a send Gmail refused as failed, and passes the refusal on', async () => {
    const { send, sends, provider } = setup();
    provider.sendMessage.mockRejectedValueOnce(new Error('Gmail said no'));

    await expect(send()).rejects.toThrow('Gmail said no');

    expect(sends.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
