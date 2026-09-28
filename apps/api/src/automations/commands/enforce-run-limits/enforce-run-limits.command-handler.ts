import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { StopSessionCommand } from '../../../sessions/commands/stop-session/stop-session.command';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import { OwnerScopeResolver } from '../../application/owner-scope.resolver';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import { EnforceRunLimitsCommand } from './enforce-run-limits.command';

/** No workspace may set a run limit below this; younger runs are not weighed. */
const SHORTEST_RUN_LIMIT_MS = 60_000;
const BATCH = 200;

/**
 * The run limit (§Configuration, `maxRunSeconds`): a run still live past its
 * workspace's limit has its session **stopped** as the owner — the agent and
 * tmux end, the worktree stays, so the session can be restarted and the work
 * resumed. Stopping ends the live turn, so the run reads as cancelled and no
 * longer holds a place on its host.
 */
@CommandHandler(EnforceRunLimitsCommand)
export class EnforceRunLimitsCommandHandler
  implements ICommandHandler<EnforceRunLimitsCommand, number>
{
  private readonly logger = new Logger(EnforceRunLimitsCommandHandler.name);

  constructor(
    @Inject(AUTOMATION_RUN_REPOSITORY)
    private readonly runs: AutomationRunRepositoryPort,
    @Inject(AUTOMATION_REPOSITORY)
    private readonly automations: AutomationRepositoryPort,
    private readonly limits: AutomationLimitsResolver,
    private readonly owners: OwnerScopeResolver,
    private readonly commandBus: CommandBus,
  ) {}

  async execute(command: EnforceRunLimitsCommand): Promise<number> {
    const now = command.now.getTime();
    const candidates = await this.runs.findLiveDispatchedBefore(
      new Date(now - SHORTEST_RUN_LIMIT_MS),
      BATCH,
    );
    const limitByWorkspace = new Map<string, number>();
    let stopped = 0;
    for (const run of candidates) {
      let limitMs = limitByWorkspace.get(run.organizationId);
      if (limitMs === undefined) {
        limitMs = (await this.limits.resolve(run.organizationId)).maxRunSeconds * 1000;
        limitByWorkspace.set(run.organizationId, limitMs);
      }
      if (now - run.dispatchedAt.getTime() <= limitMs) continue;

      const found = await this.automations.findOneByIdForSystem(run.automationId);
      if (found.isNone()) continue;
      const automation = found.unwrap();
      const scope = await this.owners.resolve(run.organizationId, automation.ownerUserId);
      if (!scope) continue;
      try {
        await this.commandBus.execute(new StopSessionCommand({ scope, sessionId: run.sessionId }));
        stopped += 1;
      } catch (error) {
        // Already closed, or no longer the owner's: nothing left to stop.
        if (!(error instanceof AppError)) throw error;
        this.logger.warn({
          message: 'A run past its limit could not be stopped',
          runId: run.runId,
          code: error.code,
        });
      }
    }
    return stopped;
  }
}
