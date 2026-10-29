import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { MailPlan } from '@oppenheimer/shared';
import { GmailCallResolver } from '../../application/gmail-call.resolver';
import { MailComposeResolver } from '../../application/mail-compose.resolver';
import { PlanMailQuery } from './plan-mail.query';

/** Resolves a requested message against the caller's account: what a card shows and a yes sends. */
@QueryHandler(PlanMailQuery)
export class PlanMailQueryHandler implements IQueryHandler<PlanMailQuery, MailPlan> {
  constructor(
    private readonly gmail: GmailCallResolver,
    private readonly compose: MailComposeResolver,
  ) {}

  async execute({ scope, connectionId, request }: PlanMailQuery): Promise<MailPlan> {
    const connection = await this.gmail.activeConnection(scope, connectionId);
    return this.compose.plan(connection, request);
  }
}
