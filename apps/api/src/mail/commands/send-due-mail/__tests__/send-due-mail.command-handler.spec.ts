import type { MailPlan } from '@oppenheimer/shared';
import type { GmailCallResolver } from '../../../application/gmail-call.resolver';
import type { MailComposeResolver } from '../../../application/mail-compose.resolver';
import type { MailSendRepositoryPort } from '../../../database/mail-send.repository.port';
import { GmailConnectionEntity } from '../../../domain/gmail-connection.entity';
import { MailSendEntity } from '../../../domain/mail-send.entity';
import type { GmailProviderPort } from '../../../infrastructure/gmail-provider.port';
import { SendDueMailCommand } from '../send-due-mail.command';
import { SendDueMailCommandHandler } from '../send-due-mail.command-handler';

/**
 * The minute job's sends (`product/next-steps/mail.md` §3.4): each due send is
 * claimed before Gmail is asked, one another writer claimed or cancelled first
 * is skipped, the stored plan is what goes, a failure is recorded and the rest
 * still go, one past the account's daily cap is not sent, and a backlog of
 * more than one batch goes in the same tick. The claim's races, against a
 * cancel and against an immediate send at the cap, are the integration
 * suite's.
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

function scheduled(subject: string): MailSendEntity {
  return MailSendEntity.schedule(
    {
      organizationId: 'org-1',
      userId: 'owner-1',
      connectionId: CONNECTION.id,
      botId: 'bot-1',
      approvalId: `approval-${subject}`,
      kind: 'new',
      accountEmail: 'ana@gmail.test',
      recipients: ['bo@client.test'],
      subject,
    },
    { ...PLAN, subject },
    new Date('2026-10-29T09:00:00Z'),
  );
}

function setup(due: MailSendEntity[]) {
  const sends = {
    findByApproval: vi.fn(),
    claim: vi.fn(),
    save: vi.fn(async () => undefined),
    countSince: vi.fn(),
    findRecentOwn: vi.fn(),
    findDue: vi.fn<MailSendRepositoryPort['findDue']>(async () => []),
    claimDueUnderCap: vi.fn<MailSendRepositoryPort['claimDueUnderCap']>(async () => ({
      outcome: 'claimed',
    })),
    cancelOwn: vi.fn(),
    findScheduledOwn: vi.fn(),
  } satisfies MailSendRepositoryPort;
  sends.findDue.mockResolvedValueOnce(due);
  const deliver = vi.fn(async (_p: unknown, _g: unknown, plan: MailPlan) => ({
    messageId: `g-${plan.subject}`,
    threadId: 't1',
  }));
  const gmail = {
    activeConnection: vi.fn(async () => CONNECTION),
    call: async <T>(_c: unknown, run: (p: GmailProviderPort, g: unknown) => Promise<T>) =>
      run({} as GmailProviderPort, {}),
  } as unknown as GmailCallResolver;
  const handler = new SendDueMailCommandHandler(
    gmail,
    { deliver } as unknown as MailComposeResolver,
    sends,
  );
  const tick = () => handler.execute(new SendDueMailCommand({ now: new Date() }));
  return { tick, sends, deliver };
}

describe('SendDueMailCommandHandler', () => {
  it('sends each due mail as its stored plan, once it has claimed it', async () => {
    const send = scheduled('Invoice 42');
    const { tick, sends, deliver } = setup([send]);

    await expect(tick()).resolves.toBe(1);

    expect(sends.claimDueUnderCap).toHaveBeenCalledWith(send, expect.any(Date), 50);
    expect(deliver.mock.calls[0][2]).toMatchObject({ subject: 'Invoice 42' });
    expect(sends.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', gmailMessageId: 'g-Invoice 42', plan: null }),
    );
  });

  it('skips a send another writer claimed or cancelled first', async () => {
    const { tick, sends, deliver } = setup([scheduled('Invoice 42')]);
    sends.claimDueUnderCap.mockResolvedValueOnce({ outcome: 'taken' });

    await expect(tick()).resolves.toBe(0);

    expect(deliver).not.toHaveBeenCalled();
    expect(sends.save).not.toHaveBeenCalled();
  });

  it('records a failed send and still sends the rest', async () => {
    const [first, second] = [scheduled('First'), scheduled('Second')];
    const { tick, sends, deliver } = setup([first, second]);
    deliver.mockRejectedValueOnce(new Error('Gmail said no'));

    await expect(tick()).resolves.toBe(1);

    expect(sends.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: first.id, status: 'failed' }),
    );
    expect(sends.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: second.id, status: 'sent' }),
    );
  });

  it('does not send one past the daily cap, which the claim has recorded as failed', async () => {
    const { tick, sends, deliver } = setup([scheduled('Fifty-first')]);
    sends.claimDueUnderCap.mockResolvedValueOnce({ outcome: 'over_cap', sentInWindow: 50 });

    await expect(tick()).resolves.toBe(0);

    expect(deliver).not.toHaveBeenCalled();
    expect(sends.save).not.toHaveBeenCalled();
  });

  it('takes another batch in the same tick while a full one came back', async () => {
    const batch = Array.from({ length: 50 }, (_, i) => scheduled(`Batch ${i}`));
    const { tick, sends } = setup(batch);
    sends.findDue.mockResolvedValueOnce([scheduled('Fifty-first')]);

    await expect(tick()).resolves.toBe(51);
    expect(sends.findDue).toHaveBeenCalledTimes(2);
  });
});
