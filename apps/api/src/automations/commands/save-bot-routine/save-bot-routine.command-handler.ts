import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { requireTenant } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { type AggregateID, ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { AutomationPlanFactory } from '../../application/automation-plan.factory';
import { BotRoutineResolver } from '../../application/bot-routine.resolver';
import { AUTOMATION_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import { AutomationEntity } from '../../domain/automation.entity';
import { AutomationErrors } from '../../domain/automations.errors';
import { SaveBotRoutineCommand } from './save-bot-routine.command';

/**
 * Creates or changes a bot's routine. A change to the prompt is the next
 * revision, the triggers are replaced whole, and `enabled` pauses or resumes
 * it; a routine of another bot, or a session automation, is not found. A
 * change to what it runs or when takes the scopes of the credential that made
 * it, so a routine never runs wider than whoever last edited it; a pause or
 * a resume leaves them as they were.
 */
@CommandHandler(SaveBotRoutineCommand)
export class SaveBotRoutineCommandHandler
  implements ICommandHandler<SaveBotRoutineCommand, AggregateID>
{
  constructor(
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly plan: AutomationPlanFactory,
    private readonly routines: BotRoutineResolver,
  ) {}

  async execute(command: SaveBotRoutineCommand): Promise<AggregateID> {
    const { scope, changes } = command;
    requireTenant(scope);
    const now = new Date();
    if (changes.triggers) await this.plan.assertMailAccounts(scope, changes.triggers);
    const triggers = changes.triggers ? this.plan.triggers(changes.triggers, now) : undefined;

    if (command.routineId === null) {
      // The tool's schema asks for all three on a create; this is the invariant behind it.
      if (!changes.name || !changes.prompt || !triggers?.length) {
        throw new ArgumentInvalidException('A new routine needs a name, a prompt and a trigger');
      }
      const routine = AutomationEntity.createRoutine({
        organizationId: scope.organizationId,
        ownerUserId: scope.userId,
        botId: command.botId,
        name: changes.name,
        prompt: changes.prompt,
        triggers,
        active: changes.enabled ?? true,
        credentialScopes: command.credentialScopes,
        now,
      });
      await this.automations.insert(routine);
      return routine.id;
    }

    const routine = await this.routines.require(scope, command.botId, command.routineId);
    const version = routine.version;
    const edits =
      changes.name !== undefined || changes.prompt !== undefined || triggers !== undefined;
    routine.change({ name: changes.name, triggers }, now);
    routine.reviseRoutine(
      {
        prompt: changes.prompt,
        credentialScopes: edits ? command.credentialScopes : undefined,
      },
      scope.userId,
      now,
    );
    if (changes.enabled === false) routine.pause('user', now);
    if (changes.enabled === true) routine.resume(now);
    const outcome = await this.automations.save(routine, version);
    if (outcome === 'conflict') throw new AppError(AutomationErrors.VERSION_CONFLICT);
    return routine.id;
  }
}
