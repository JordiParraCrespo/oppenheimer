import { Inject, Logger } from '@nestjs/common';
import { CommandBus, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { StopSessionCommand } from '../../../sessions/commands/stop-session/stop-session.command';
import { AutomationLimitsResolver } from '../../application/automation-limits.resolver';
import { OwnerScopeResolver } from '../../application/owner-scope.resolver';
import { AUTOMATION_REPOSITORY, AUTOMATION_RUN_REPOSITORY } from '../../automations.di-tokens';
import type { AutomationRepositoryPort } from '../../database/automation.repository.port';
import type { AutomationRunRepositoryPort } from '../../database/automation-run.repository.port';
import type { AutomationEntity } from '../../domain/automation.entity';
import { EnforceRunLimitsCommand } from './enforce-run-limits.command';

/** No workspace may set a run limit below this; younger runs are not weighed. */
const SHORTEST_RUN_LIMIT_MS = 60_000;
const BATCH = 200;
/** How long past the platform's run ceiling a run the stop could not end is still retried. */
const ZOMBIE_GRACE_MS = 60 * 60 * 1000;

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
    // A run live past the platform's ceiling plus a grace is one the stop could
    // not end: it is no longer retried, so it cannot hold every slot of the batch.
    const candidates = await this.runs.findLiveDispatchedBefore(
      new Date(now - SHORTEST_RUN_LIMIT_MS),
      new Date(now - (this.limits.maxRunCeilingMs + ZOMBIE_GRACE_MS)),
      BATCH,
    );
    const limitByWorkspace = new Map<string, number>();
    const automationById = new Map<string, AutomationEntity | null>();
    const scopeByOwner = new Map<string, AccessScope | null>();
    let stopped = 0;
    for (const run of candidates) {
      let limitMs = limitByWorkspace.get(run.organizationId);
      if (limitMs === undefined) {
        limitMs = (await this.limits.resolve(run.organizationId)).maxRunSeconds * 1000;
        limitByWorkspace.set(run.organizationId, limitMs);
      }
      if (now - run.dispatchedAt.getTime() <= limitMs) continue;

      let automation = automationById.get(run.automationId);
      if (automation === undefined) {
        const found = await this.automations.findOneByIdForSystem(run.automationId);
        automation = found.isSome() ? found.unwrap() : null;
        automationById.set(run.automationId, automation);
      }
      if (!automation) continue;
      const ownerKey = `${run.organizationId}:${automation.ownerUserId}`;
      let scope = scopeByOwner.get(ownerKey);
      if (scope === undefined) {
        scope = await this.owners.resolve(run.organizationId, automation.ownerUserId);
        scopeByOwner.set(ownerKey, scope);
      }
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
