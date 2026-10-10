import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { CreateSessionCommand } from '../../../sessions/commands/create-session/create-session.command';
import type { SessionCommandResult } from '../../../sessions/domain/session-command.types';
import { RunDispatchResolver } from '../../application/run-dispatch.resolver';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationEntity } from '../../domain/automation.entity';
import type { AutomationRunEntity } from '../../domain/automation-run.entity';
import { runRefusalOf } from '../../domain/run-refusal.policy';
import { DispatchAutomationRunCommand } from './dispatch-automation-run.command';

/**
 * Dispatch: the guards decide, and a run that passes becomes a session created
 * **as the automation's owner**, through the same command a person's session
 * goes through (§Q5). The session's idempotency key is the run's id, so a job
 * the queue runs twice — or a crash between the create and the write below —
 * finds the session already made instead of making a second.
 */
@CommandHandler(DispatchAutomationRunCommand)
export class DispatchAutomationRunCommandHandler
  implements ICommandHandler<DispatchAutomationRunCommand, string>
{
  private readonly logger = new Logger(DispatchAutomationRunCommandHandler.name);

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly resolver: RunDispatchResolver,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: DispatchAutomationRunCommand): Promise<string> {
    const foundRun = await this.runs.findOneForSystem(command.runId);
    if (foundRun.isNone() || !foundRun.unwrap().isPending) return 'settled';
    const run = foundRun.unwrap();
    // A deferred run's job can be claimed early by a retry; it waits its turn.
    if (run.availableAt.getTime() > Date.now() + 1_000) return 'not-yet';
    const foundAutomation = await this.automations.findOneByIdForSystem(run.automationId);
    if (foundAutomation.isNone()) return 'settled';
    const automation = foundAutomation.unwrap();
    const now = new Date();
    const { correlationId } = command.metadata;

    const decision = await this.resolver.decide(run, automation, now);
    switch (decision.kind) {
      case 'skip':
        run.skip(decision.reason);
        await this.runs.save(run, correlationId);
        if (decision.pause) await this.pause(automation, decision.pause, now);
        return decision.reason;
      case 'expire':
        run.expire();
        await this.runs.save(run, correlationId);
        return 'expired';
      case 'defer':
        run.defer(decision.until);
        await this.runs.save(run, correlationId);
        return 'deferred';
      case 'launch':
        return this.launch(run, automation, decision.scope, decision.input, now, correlationId);
    }
  }

  private async launch(
    run: AutomationRunEntity,
    automation: AutomationEntity,
    scope: AccessScope,
    input: CreateSessionCommand['input'],
    now: Date,
    correlationId: string,
  ): Promise<string> {
    try {
      const result = await this.commandBus.execute<CreateSessionCommand, SessionCommandResult>(
        new CreateSessionCommand({
          scope,
          userId: automation.ownerUserId,
          input,
          idempotencyKey: `automation-run:${run.id}`,
          origin: 'automation',
        }),
      );
      run.dispatched(result.sessionId, automation.revision.id, new Date());
      await this.runs.save(run, correlationId);
      return 'dispatched';
    } catch (error) {
      const refusal = runRefusalOf(error instanceof AppError ? error.code : undefined);
      if (!refusal) throw error; // a fault, not a refusal: the queue retries it
      this.logger.warn({
        message: 'An automation run was refused at dispatch',
        runId: run.id,
        code: (error as AppError).code,
      });
      run.skip(refusal.reason);
      await this.runs.save(run, correlationId);
      if (refusal.pause) await this.pause(automation, refusal.pause, now);
      return refusal.reason;
    }
  }

  private async pause(
    automation: AutomationEntity,
    reason: Parameters<AutomationEntity['pause']>[0],
    now: Date,
  ): Promise<void> {
    if (automation.isDeleted || automation.isPaused) return;
    automation.pause(reason, now);
    await this.automations.saveForSystem(automation);
  }
}
