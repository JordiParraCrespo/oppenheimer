import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { PauseUnattendedRoutinesCommand } from './pause-unattended-routines.command';

/**
 * Pauses a bot's routines as `unattended`, all at once, so a weekly one does
 * not run once more before the guard sees it. A routine already paused keeps
 * its own reason: one the owner paused stays paused when they come back.
 * Idempotent, so each routine's pause raising this again changes nothing.
 * Answers the routine whose pause tells the owner, the oldest one paused as
 * `unattended`, so the chat says it once however many there are; null when
 * there is none.
 */
@CommandHandler(PauseUnattendedRoutinesCommand)
export class PauseUnattendedRoutinesCommandHandler
  implements ICommandHandler<PauseUnattendedRoutinesCommand, string | null>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
  ) {}

  async execute({ organizationId, botId }: PauseUnattendedRoutinesCommand): Promise<string | null> {
    const now = new Date();
    // Oldest first, so the first one paused as `unattended` is the one that tells.
    const routines = await this.automations.findRoutinesOfBotForSystem(organizationId, botId);
    for (const routine of routines) {
      if (routine.isPaused) continue;
      routine.pause('unattended', now);
      await this.automations.saveForSystem(routine);
    }
    return routines.find((routine) => routine.pausedReason === 'unattended')?.id ?? null;
  }
}
