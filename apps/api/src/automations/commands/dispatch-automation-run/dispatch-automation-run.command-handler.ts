import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type DispatchDecision,
  RunDispatchResolver,
} from '../../application/run-dispatch.resolver';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationEntity } from '../../domain/automation.entity';
import type { AutomationRunEntity } from '../../domain/automation-run.entity';
import { DispatchAutomationRunCommand } from './dispatch-automation-run.command';

/**
 * Dispatch: the guards decide, and a run that passes is launched by its
 * automation's target **as the owner** (§Q5, `26-bot-routines.md` §3) — a
 * session today. The target's launch is idempotent on the run's id, so a job
 * the queue runs twice — or a crash between the launch and the write below —
 * finds what it launched instead of launching a second.
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
        return this.launch(run, automation, decision, now, correlationId);
    }
  }

  private async launch(
    run: AutomationRunEntity,
    automation: AutomationEntity,
    { target, launch, refusalOf }: Extract<DispatchDecision, { kind: 'launch' }>,
    now: Date,
    correlationId: string,
  ): Promise<string> {
    try {
      run.dispatched(await launch(), automation.revision.id, new Date());
      await this.runs.save(run, correlationId);
      return 'dispatched';
    } catch (error) {
      const refusal = refusalOf(error);
      if (!refusal) throw error; // a fault, not a refusal: the queue retries it
      this.logger.warn({
        message: 'An automation run was refused at dispatch',
        runId: run.id,
        target,
        code: (error as { code?: string }).code,
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
