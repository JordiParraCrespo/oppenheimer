import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { CloudSessionState } from '@oppenheimer/shared';
import type { WorkSessionRepositoryPort } from '../../database/work-session.repository.port';
import { type AgentObservedState, SESSION_EVENT_KINDS } from '../../domain/session-state.policy';
import { WorkSessionEntity } from '../../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../../sessions.di-tokens';
import { RecordCloudStatusCommand } from './record-cloud-status.command';

export interface RecordCloudStatusResult {
  /** How many of the reported sessions this workspace launched, and so recorded. */
  matched: number;
}

/**
 * What the extension saw on claude.ai, in the observed vocabulary a runner's
 * screen reading uses, so a cloud session's dot is drawn by the same rules as
 * any other (`session-group.policy.ts`). A failed turn waits on the person as a
 * question does; a finished one is ready for a prompt.
 */
const OBSERVED: Record<CloudSessionState, AgentObservedState> = {
  running: 'working',
  'needs-input': 'blocked',
  failed: 'blocked',
  done: 'done',
  stopped: 'done',
};

/**
 * Records the browser extension's view of the person's Claude Code cloud
 * sessions as `agent.observed`, for the ones this workspace launched; the rest
 * are not this API's to know about, and are dropped unread.
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
  ) {}

  async execute(command: RecordCloudStatusCommand): Promise<RecordCloudStatusResult> {
    const reported = new Map(
      command.report.sessions.map((entry) => [entry.cloudSessionId, entry.state]),
    );
    const sessions = await this.sessions.findCloudByCloudIds(command.scope, [...reported.keys()]);

    for (const session of sessions) {
      const cloudState = session.cloudSessionId ? reported.get(session.cloudSessionId) : undefined;
      if (!cloudState) continue;
      const state = OBSERVED[cloudState];
      const confirmsBlocked = state === 'blocked' && session.observedSince === null;
      if (session.lastObservedState === state && !confirmsBlocked) continue;

      await this.sessions.appendEvents(session, [
        {
          idempotencyKey: WorkSessionEntity.apiIdempotencyKey(
            `${command.id}:${session.id}`,
            SESSION_EVENT_KINDS.AGENT_OBSERVED,
          ),
          source: 'api',
          kind: SESSION_EVENT_KINDS.AGENT_OBSERVED,
          payload: { state, cloudState },
        },
      ]);
    }
    return { matched: sessions.length };
  }
}
