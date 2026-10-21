import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { BotRoutineRef } from '../../domain/automation-read.types';
import { FindBotRoutineRefQuery } from './find-bot-routine-ref.query';

/** The routine's bot and name; null for a session automation, or one that is gone. */
@QueryHandler(FindBotRoutineRefQuery)
export class FindBotRoutineRefQueryHandler
  implements IQueryHandler<FindBotRoutineRefQuery, BotRoutineRef | null>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute({ automationId }: FindBotRoutineRefQuery): Promise<BotRoutineRef | null> {
    const found = await this.automations.findOneByIdForSystem(automationId);
    if (found.isNone()) return null;
    const automation = found.unwrap();
    const { target } = automation;
    if (target.kind !== 'bot') return null;
    return {
      organizationId: automation.organizationId,
      botId: target.botId,
      name: automation.name,
    };
  }
}
