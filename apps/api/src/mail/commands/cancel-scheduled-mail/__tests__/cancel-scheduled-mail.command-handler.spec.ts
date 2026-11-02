import { emptyScope } from '../../../../authz/domain/access-scope.types';
import type { MailSendRepositoryPort } from '../../../database/mail-send.repository.port';
import { CancelScheduledMailCommand } from '../cancel-scheduled-mail.command';
import { CancelScheduledMailCommandHandler } from '../cancel-scheduled-mail.command-handler';

/**
 * Cancelling a scheduled send (`product/next-steps/mail.md` §3.4): one that
 * still waits is stopped; one that no longer waits is `MAIL_017`. The race
 * between a cancel and the minute job's claim is the integration suite's.
 */
describe('CancelScheduledMailCommandHandler', () => {
  it('refuses with MAIL_017 a send that no longer waits', async () => {
    const sends = { cancelOwn: vi.fn(async () => false) } as unknown as Pick<
      MailSendRepositoryPort,
      'cancelOwn'
    > & { cancelOwn: ReturnType<typeof vi.fn> };
    const handler = new CancelScheduledMailCommandHandler(
      sends as unknown as MailSendRepositoryPort,
    );

    await expect(
      handler.execute(
        new CancelScheduledMailCommand({ scope: emptyScope('owner-1', 'org-1'), sendId: 'send-1' }),
      ),
    ).rejects.toMatchObject({ code: 'MAIL_017' });

    sends.cancelOwn.mockResolvedValueOnce(true);
    await expect(
      handler.execute(
        new CancelScheduledMailCommand({ scope: emptyScope('owner-1', 'org-1'), sendId: 'send-1' }),
      ),
    ).resolves.toBe('send-1');
  });
});
