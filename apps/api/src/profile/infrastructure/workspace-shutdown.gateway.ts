import { Injectable, Logger } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { emptyScope } from '@oppenheimer/backend-authz';
import type { Paginated } from '@oppenheimer/backend-ddd';
import { UnpairHostCommand } from '../../hosts/commands/unpair-host/unpair-host.command';
import type { HostPresence } from '../../hosts/database/host.repository.port';
import { FindHostsQuery } from '../../hosts/queries/find-hosts/find-hosts.query';
import { StopSessionCommand } from '../../sessions/commands/stop-session/stop-session.command';
import type { WorkSessionEntity } from '../../sessions/domain/work-session.entity';
import { FindSessionsQuery } from '../../sessions/queries/find-sessions/find-sessions.query';
import type { WorkspaceShutdownPort } from './workspace-shutdown.port';

const PAGE = 100;

/**
 * Stops sessions and unpairs hosts through the owning modules' own commands,
 * so what a host is told — the stop frame, the link closed with the terminal
 * unpaired code so the runner stops dialling — is exactly what the console's
 * own Stop and Remove host send.
 *
 * The scopes built here are the narrowest that reach the work: a workspace by
 * id, hosts by owner. Never the caller's request scope — a platform admin's
 * bypasses tenancy, and deleting their own account must not stop everybody's
 * sessions.
 */
@Injectable()
export class WorkspaceShutdownGateway implements WorkspaceShutdownPort {
  private readonly logger = new Logger(WorkspaceShutdownGateway.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async stopSessions(userId: string, workspaceIds: readonly string[]): Promise<void> {
    for (const workspaceId of workspaceIds) {
      const scope = emptyScope(userId, workspaceId);
      for (const state of ['starting', 'open'] as const) {
        // Stopping does not change the stored state, so the pages hold still
        // while they are walked.
        for (let page = 1; ; page++) {
          const result = await this.queryBus.execute<
            FindSessionsQuery,
            Paginated<WorkSessionEntity>
          >(new FindSessionsQuery({ scope, page, limit: PAGE, state }));
          for (const session of result.data) {
            await this.bestEffort('stop a session', { sessionId: session.id }, () =>
              this.commandBus.execute(new StopSessionCommand({ scope, sessionId: session.id })),
            );
          }
          if (result.data.length < PAGE) break;
        }
      }
    }
  }

  async unpairHosts(userId: string): Promise<void> {
    const scope = emptyScope(userId);
    const hosts = await this.queryBus.execute<FindHostsQuery, HostPresence[]>(
      new FindHostsQuery({ scope }),
    );
    for (const { host } of hosts) {
      if (host.isUnpaired) continue;
      await this.bestEffort('unpair a host', { hostId: host.id }, () =>
        this.commandBus.execute(new UnpairHostCommand({ scope, hostId: host.id })),
      );
    }
  }

  private async bestEffort(
    what: string,
    context: Record<string, string>,
    step: () => Promise<unknown>,
  ): Promise<void> {
    try {
      await step();
    } catch (error) {
      this.logger.warn({
        message: `deleting an account could not ${what}; carrying on`,
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
