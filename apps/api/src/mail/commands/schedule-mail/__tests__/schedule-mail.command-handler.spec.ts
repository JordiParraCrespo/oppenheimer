import type { MailPlan } from '@oppenheimer/shared';
import { None, Some } from 'oxide.ts';
import { emptyScope } from '../../../../authz/domain/access-scope.types';
import type { GmailCallResolver } from '../../../application/gmail-call.resolver';
import type { MailSendRepositoryPort } from '../../../database/mail-send.repository.port';
import { GmailConnectionEntity } from '../../../domain/gmail-connection.entity';
import type { MailSendEntity } from '../../../domain/mail-send.entity';
import { ScheduleMailCommand } from '../schedule-mail.command';
import { ScheduleMailCommandHandler } from '../schedule-mail.command-handler';

/**
 * Scheduling (`product/next-steps/mail.md` §3.4): a yes keeps
 * the plan to send at its time, once per approval; a time already past when
 * the yes lands is refused (`MAIL_016`), as is a file from the chat, which
 * cannot wait (`MAIL_018`).
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

function setup(prior?: MailSendEntity) {
  const sends = {
    findByApproval: vi.fn(async () => (prior ? Some(prior) : None)),
    claim: vi.fn(async () => true),
    save: vi.fn(),
    countSince: vi.fn(),
    findRecentOwn: vi.fn(),
    findDue: vi.fn(),
    claimDueUnderCap: vi.fn(),
    cancelOwn: vi.fn(async () => false),
    findScheduledOwn: vi.fn(),
  } satisfies MailSendRepositoryPort;
  const gmail = { activeConnection: vi.fn(async () => CONNECTION) } as unknown as GmailCallResolver;
  const handler = new ScheduleMailCommandHandler(gmail, sends);
  const schedule = (sendAt: Date, plan: MailPlan = PLAN) =>
    handler.execute(
      new ScheduleMailCommand({
        scope: emptyScope('owner-1', 'org-1'),
        plan,
        sendAt,
        approvalId: 'approval-1',
        botId: 'bot-1',
      }),
    );
  return { schedule, sends };
}

const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000);

describe('ScheduleMailCommandHandler', () => {
  it('keeps the plan to send at its time', async () => {
    const { schedule, sends } = setup();
    const at = inAnHour();

    const id = await schedule(at);

    const [send] = sends.claim.mock.calls[0];
    expect(send).toMatchObject({ id, status: 'scheduled', scheduledFor: at, plan: PLAN });
  });

  it('answers a retried approval with the send it already scheduled', async () => {
    const first = setup();
    await first.schedule(inAnHour());
    const [prior] = first.sends.claim.mock.calls[0];

    const retry = setup(prior);
    await expect(retry.schedule(inAnHour())).resolves.toBe(prior.id);
    expect(retry.sends.claim).not.toHaveBeenCalled();
  });

  it('refuses a time already past with MAIL_016 and an image from the chat with MAIL_018', async () => {
    const { schedule, sends } = setup();

    await expect(schedule(new Date(Date.now() - 1000))).rejects.toMatchObject({ code: 'MAIL_016' });
    await expect(
      schedule(inAnHour(), {
        ...PLAN,
        attachments: [
          {
            source: 'chat',
            attachmentId: '7c2f0d2e-4c39-4d8e-9a11-0f5b2b6f1a10',
            filename: 'receipt.png',
            mimeType: 'image/png',
            sizeBytes: 3,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MAIL_018' });
    expect(sends.claim).not.toHaveBeenCalled();
  });
});
