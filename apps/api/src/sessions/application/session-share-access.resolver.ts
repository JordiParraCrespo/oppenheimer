import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionShareRepositoryPort } from '../database/session-share.repository.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import type { SessionShareEntity, SessionShareViewer } from '../domain/session-share.entity';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { SESSION_SHARE_REPOSITORY, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

export interface OpenedShare {
  share: SessionShareEntity;
  session: WorkSessionEntity;
  viewer: SessionShareViewer;
}

/**
 * What a share's address opens, for this viewer, or the refusal.
 *
 * Opening a share always needs an account, so nobody signed in is told to
 * sign in before anything is read: a signed-out caller learns nothing about
 * the address, not even whether it was ever shared. The lookup is unscoped, by the address, then the session it names, read
 * the way the relay reads one; the share's own judgment of the viewer is the
 * authorization. A closed session, or a share pointing outside its own
 * workspace's session, is the same `SHARE_NOT_FOUND` as an unknown address.
 * What the person who shared it may still do is not asked here: the relay
 * asks it, at redemption and on its timer, which is where it can change
 * under an open terminal.
 */
@Injectable()
export class SessionShareAccessResolver {
  constructor(
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async open(slug: string, viewer: SessionShareViewer | null): Promise<OpenedShare> {
    if (!viewer) throw new AppError(SessionErrors.SHARE_SIGN_IN_REQUIRED);
    const found = await this.shares.findOneBySlug(slug);
    if (found.isNone()) throw new AppError(SessionErrors.SHARE_NOT_FOUND);
    const share = found.unwrap();
    switch (share.refusalFor(viewer)) {
      case 'gone':
        throw new AppError(SessionErrors.SHARE_NOT_FOUND);
      case 'not_invited':
        throw new AppError(SessionErrors.SHARE_NOT_INVITED);
    }
    const loaded = await this.sessions.findOneByIdForMachine(share.sessionId);
    const session = loaded.isSome() ? loaded.unwrap() : null;
    if (!session || session.organizationId !== share.organizationId || session.isResolved) {
      throw new AppError(SessionErrors.SHARE_NOT_FOUND);
    }
    return { share, session, viewer };
  }
}
