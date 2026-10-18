import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import { AUTOMATION_REPOSITORY } from '../automations.di-tokens';
import type { AutomationRepositoryPort } from '../database/automation.repository.port';
import type { AutomationEntity } from '../domain/automation.entity';
import { AutomationErrors } from '../domain/automations.errors';

/**
 * A bot's routine, loaded for a write a bot or its Routines tab makes
 * (`26-bot-routines.md` §7): saving, running now or deleting one. One rule,
 * on the load: anything but that bot's routine is not found, a session
 * automation and another bot's routine alike, so no handler grows its own
 * copy of the check.
 */
@Injectable()
export class BotRoutineResolver {
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async require(scope: AccessScope, botId: string, routineId: string): Promise<AutomationEntity> {
    const routine = requireFound(
      await this.automations.findOneById(scope, routineId),
      AutomationErrors.NOT_FOUND,
    );
    if (!routine.isRoutineOf(botId)) throw new AppError(AutomationErrors.NOT_FOUND);
    return routine;
  }
}
