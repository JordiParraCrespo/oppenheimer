import { None, Some } from 'oxide.ts';
import type { InboxReportRepositoryPort } from '../../../database/inbox-report.repository.port';
import { InboxReportEntity } from '../../../domain/inbox-report.entity';
import { AnswerInboxReportCommand } from '../answer-inbox-report.command';
import { AnswerInboxReportCommandHandler } from '../answer-inbox-report.command-handler';

/**
 * POST /inbox/reports/:id/answer: a report takes one answer. A second is
 * INBOX_006 whether the first is already read back or lands between this
 * one's read and its write, and it never replaces the first.
 */
function setup(report: InboxReportEntity | null) {
  const reports = {
    findOne: vi.fn(async (_organizationId: string, _id: string) => (report ? Some(report) : None)),
    saveAnswer: vi.fn(async (_report: InboxReportEntity) => true),
  } satisfies Partial<InboxReportRepositoryPort>;
  const handler = new AnswerInboxReportCommandHandler(
    reports as unknown as InboxReportRepositoryPort,
  );
  const answer = (text = 'Roll it back') =>
    handler.execute(
      new AnswerInboxReportCommand({
        organizationId: 'org-1',
        userId: 'owner-1',
        reportId: report?.id ?? 'r-0',
        text,
      }),
    );
  return { reports, answer };
}

function open(): InboxReportEntity {
  const report = InboxReportEntity.post({
    organizationId: 'org-1',
    createdByUserId: 'agent-1',
    title: 'Checkout is down',
    body: '',
    source: '',
    link: null,
    images: [],
  });
  report.clearEvents();
  return report;
}

describe('AnswerInboxReportCommandHandler', () => {
  it("writes the person's answer on an open report of their workspace, with its event", async () => {
    const report = open();
    const { reports, answer } = setup(report);

    await expect(answer()).resolves.toBe(report.id);

    expect(reports.findOne).toHaveBeenCalledWith('org-1', report.id);
    const [saved] = reports.saveAnswer.mock.calls[0];
    expect(saved).toMatchObject({
      status: 'answered',
      answer: 'Roll it back',
      answeredByUserId: 'owner-1',
    });
    expect(saved.domainEvents).toHaveLength(1);
  });

  it('refuses a report already answered with INBOX_006, writing nothing', async () => {
    const report = open();
    report.answerWith('Roll it back', 'owner-1', new Date());
    const { reports, answer } = setup(report);
    await expect(answer('Never mind')).rejects.toMatchObject({ code: 'INBOX_006' });
    expect(reports.saveAnswer).not.toHaveBeenCalled();
  });

  it('answers INBOX_006 when another answer landed between its read and its write', async () => {
    const { reports, answer } = setup(open());
    reports.saveAnswer.mockResolvedValueOnce(false);
    await expect(answer()).rejects.toMatchObject({ code: 'INBOX_006' });
  });

  it('answers INBOX_005 for a report the workspace does not have', async () => {
    const { reports, answer } = setup(null);
    await expect(answer()).rejects.toMatchObject({ code: 'INBOX_005' });
    expect(reports.saveAnswer).not.toHaveBeenCalled();
  });
});
