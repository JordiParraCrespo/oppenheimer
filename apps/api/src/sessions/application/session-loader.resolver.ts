import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/** A session that runs on a host, whose `hostId` a host-only command can use as is. */
export type HostSession = WorkSessionEntity & { readonly hostId: string };

/**
 * The session as a host session, or the refusal of a cloud one
 * (`SESSIONS_036`): what a terminal, a checkout, a restart or a share asks first.
 */
export function requireOnHost(session: WorkSessionEntity): HostSession {
  const refusal = session.hostRefusal;
  if (refusal) {
    throw new AppError(refusal, { detail: `Session ${session.slug} runs at its vendor` });
  }
  return session as HostSession;
}

/**
 * The session a request acts on, loaded in the caller's scope, or the refusal.
 *
 * A session outside the scope is **not found**, the same answer as one that does
 * not exist, so a caller cannot learn that an id is real. {@link requireLive} adds
 * the second refusal most commands share: a resolved session takes no more work.
 * Commands that treat a resolved session differently — closing is a no-op on one,
 * pasting refuses through the session's own input rule — call {@link find}.
 * A command only a host session takes adds {@link requireOnHost}.
 */
@Injectable()
export class SessionLoaderResolver {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async find(scope: AccessScope, sessionId: string): Promise<WorkSessionEntity> {
    return requireFound(
      await this.sessions.findOneById(scope, sessionId),
      SessionErrors.NOT_FOUND,
      {
        detail: `No session with id ${sessionId}`,
      },
    );
  }

  async requireLive(scope: AccessScope, sessionId: string): Promise<WorkSessionEntity> {
    const session = await this.find(scope, sessionId);
    if (session.isResolved) {
      throw new AppError(SessionErrors.ALREADY_RESOLVED, {
        detail: `Session ${session.slug} is closed`,
      });
    }
    return session;
  }

  /** {@link requireLive}, for a command only a host session takes. */
  async requireLiveOnHost(scope: AccessScope, sessionId: string): Promise<HostSession> {
    return requireOnHost(await this.requireLive(scope, sessionId));
  }
}
