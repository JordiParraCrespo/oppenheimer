import { Inject, Injectable } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { AppError, requireFound } from '@oppenheimer/backend-core';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

/**
 * The session a request acts on, loaded in the caller's scope, or the refusal.
 *
 * A session outside the scope is **not found**, the same answer as one that does
 * not exist, so a caller cannot learn that an id is real. {@link requireLive} adds
 * the second refusal most commands share: a resolved session takes no more work.
 * Commands that treat a resolved session differently — closing is a no-op on one,
 * pasting refuses through the session's own input rule — call {@link find}.
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
}
