import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireOrganization } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { InboxReportRepositoryPort } from '../../database/inbox-report.repository.port';
import { InboxErrors } from '../../domain/inbox.errors';
import { INBOX_REPORT_REPOSITORY } from '../../inbox.di-tokens';
import { AnswerInboxReportCommand } from './answer-inbox-report.command';

/**
 * The person answers a report in their Inbox, once. A report already
 * answered keeps its answer, whether that is seen on the read or lost to
 * another answer landing first.
 */
@CommandHandler(AnswerInboxReportCommand)
export class AnswerInboxReportCommandHandler
  implements ICommandHandler<AnswerInboxReportCommand, string>
{
  constructor(
    @Inject(INBOX_REPORT_REPOSITORY) private readonly reports: InboxReportRepositoryPort,
  ) {}

  async execute(command: AnswerInboxReportCommand): Promise<string> {
    const { organizationId, userId, reportId, text } = command;
    requireOrganization(organizationId);
    const report = requireFound(
      await this.reports.findOne(organizationId, reportId),
      InboxErrors.REPORT_NOT_FOUND,
      { detail: `No report ${reportId}` },
    );
    const alreadyAnswered = new AppError(InboxErrors.REPORT_ALREADY_ANSWERED, {
      detail: `Report ${reportId} has its answer`,
    });
    if (report.status === 'answered') throw alreadyAnswered;
    report.answerWith(text, userId, new Date());
    if (!(await this.reports.saveAnswer(report))) throw alreadyAnswered;
    return report.id;
  }
}
