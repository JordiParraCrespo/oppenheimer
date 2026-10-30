import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MailPlan } from '@oppenheimer/shared';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import { PlanMailDraftQuery } from './plan-mail-draft.query';

@QueryHandler(PlanMailDraftQuery)
export class PlanMailDraftQueryHandler implements IQueryHandler<PlanMailDraftQuery, MailPlan> {
  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
  ) {}

  async execute({ scope, connectionId, draftId }: PlanMailDraftQuery): Promise<MailPlan> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.compose.planDraft(connection, draftId);
  }
}
