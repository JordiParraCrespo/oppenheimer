import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { WorkSessionMapper } from '../../work-session.mapper';
import { RecordCloudStatusCommand } from './record-cloud-status.command';

export interface RecordCloudStatusResult {
  /** How many of the reported sessions this workspace launched, and so recorded. */
  matched: number;
}

/**
 * Records the browser extension's view of the person's Claude Code cloud
 * sessions as `agent.observed`, for the ones this workspace launched; the rest
 * are not this API's to know about, and are dropped unread. The vocabulary
 * and the entry are the mapper's.
 *
 * The extension reports every minute, so an entry is written only when it says
 * something new: a change of state, or the second report of `blocked`, which is
 * what starts the clock on "waiting on you" (`observedSince`). Anything else is
 * a repeat the log already holds.
 */
@CommandHandler(RecordCloudStatusCommand)
export class RecordCloudStatusCommandHandler
  implements ICommandHandler<RecordCloudStatusCommand, RecordCloudStatusResult>
{
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    private readonly mapper: WorkSessionMapper,
  ) {}

  async execute(command: RecordCloudStatusCommand): Promise<RecordCloudStatusResult> {
    const reported = new Map(
      command.report.sessions.map((entry) => [entry.cloudSessionId, entry.state]),
    );
    const sessions = await this.sessions.findCloudByCloudIds(command.scope, [...reported.keys()]);

    for (const session of sessions) {
      const cloudState = session.cloudSessionId ? reported.get(session.cloudSessionId) : undefined;
      if (!cloudState) continue;
      const state = this.mapper.cloudObservedState(cloudState);
      const confirmsBlocked = state === 'blocked' && session.observedSince === null;
      if (session.lastObservedState === state && !confirmsBlocked) continue;
      await this.sessions.appendEvents(session, [
        this.mapper.toCloudObservedEvent(command.id, session, cloudState),
      ]);
    }
    return { matched: sessions.length };
  }
}
