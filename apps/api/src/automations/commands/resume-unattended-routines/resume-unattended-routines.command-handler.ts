import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { ResumeUnattendedRoutinesCommand } from './resume-unattended-routines.command';

/**
 * Resumes a bot's routines paused as `unattended`, and only those: one the
 * owner paused, or one paused for a missing key, stays paused. Answers how
 * many it resumed; none is the usual answer, and costs one indexed read.
 */
@CommandHandler(ResumeUnattendedRoutinesCommand)
export class ResumeUnattendedRoutinesCommandHandler
  implements ICommandHandler<ResumeUnattendedRoutinesCommand, number>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute({ organizationId, botId }: ResumeUnattendedRoutinesCommand): Promise<number> {
    const now = new Date();
    let resumed = 0;
    for (const routine of await this.automations.findRoutinesOfBotForSystem(
      organizationId,
      botId,
    )) {
      if (routine.pausedReason !== 'unattended') continue;
      routine.resume(now);
      await this.automations.saveForSystem(routine);
      resumed += 1;
    }
    return resumed;
  }
}
