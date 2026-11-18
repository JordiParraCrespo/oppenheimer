import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionLoaderResolver } from '../../application/session-loader.resolver';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import type { SessionCommandResult } from '../../domain/session-command.types';
import { reportAcknowledgedEntry } from '../../domain/session-log-entry.factory';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { AcknowledgeSessionReportCommand } from './acknowledge-session-report.command';

/**
 * Records that the person read what the agent's last turn left: the console
 * opened the session. Its group falls from `ready-for-review` to `idle`, and
 * every console open on the workspace hears of it as of any other change.
 *
 * It reads the report it acknowledges off the row, so a turn that ends after
 * the console looked is a new report, still unread. With nothing unread it
 * writes nothing.
 */
@CommandHandler(AcknowledgeSessionReportCommand)
export class AcknowledgeSessionReportCommandHandler
  implements ICommandHandler<AcknowledgeSessionReportCommand, SessionCommandResult>
{
  constructor(
    private readonly loader: SessionLoaderResolver,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async execute(command: AcknowledgeSessionReportCommand): Promise<SessionCommandResult> {
    const session = await this.loader.find(command.scope, command.sessionId);
    const hash = session.unreadReportHash;
    if (hash) {
      await this.sessions.appendEvents(session, [reportAcknowledgedEntry(command.id, hash)]);
    }
    // Nothing on the host hears of it: what was read is the console's.
    return { sessionId: session.id, hints: [] };
  }
}
