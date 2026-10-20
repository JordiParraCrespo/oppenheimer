import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AggregateID } from '@oppenheimer/backend-ddd';
import { BotRoutineResolver } from '../../application/bot-routine.resolver';
import { AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import { AutomationRunEntity } from '../../domain/automation-run.entity';
import { manualFiring } from '../../domain/run-launch.policy';
import { RunBotRoutineCommand } from './run-bot-routine.command';

/** Run now for a bot's routine: the same firing as an automation's, on that bot's routine only. */
@CommandHandler(RunBotRoutineCommand)
export class RunBotRoutineCommandHandler
  implements ICommandHandler<RunBotRoutineCommand, AggregateID>
{
  constructor(
    private readonly routines: BotRoutineResolver,
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
  ) {}

  async execute(command: RunBotRoutineCommand): Promise<AggregateID> {
    const routine = await this.routines.require(command.scope, command.botId, command.routineId);
    const run = AutomationRunEntity.fire(
      manualFiring(routine, command.scope.userId, command.idempotencyKey ?? command.id),
      new Date(),
    );
    return (await this.runs.insertFiring(run, command.metadata.correlationId)).runId;
  }
}
