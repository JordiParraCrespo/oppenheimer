import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '@oppenheimer/backend-core';
import type { SessionShareLinkRepositoryPort } from '../database/session-share-link.repository.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import {
  hashShareToken,
  type SessionShareLinkEntity,
  type ShareLinkViewer,
} from '../domain/session-share-link.entity';
import { SessionErrors } from '../domain/sessions.errors';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { SESSION_SHARE_LINK_REPOSITORY, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';

export interface OpenedShareLink {
  link: SessionShareLinkEntity;
  session: WorkSessionEntity;
}

/**
 * What a holder's secret opens, for this viewer, or the refusal.
 *
 * The secret is the authorization, so the lookup is unscoped: by its digest,
 * then the session it names, read the way the relay reads one. A closed
 * session, or a link pointing outside its own workspace's session, is the same
 * `SHARE_LINK_NOT_FOUND` as an unknown secret. What the link's creator may
 * still do is not asked here: the relay asks it, at redemption and on its
 * timer, which is where it can change under an open terminal.
 */
@Injectable()
export class ShareLinkAccessResolver {
  constructor(
    @Inject(SESSION_SHARE_LINK_REPOSITORY)
    private readonly links: SessionShareLinkRepositoryPort,
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
  ) {}

  async open(token: string, viewer: ShareLinkViewer | null): Promise<OpenedShareLink> {
    const found = await this.links.findOneByTokenHash(hashShareToken(token));
    if (found.isNone()) throw new AppError(SessionErrors.SHARE_LINK_NOT_FOUND);
    const link = found.unwrap();
    switch (link.refusalFor(viewer)) {
      case 'gone':
        throw new AppError(SessionErrors.SHARE_LINK_NOT_FOUND);
      case 'sign_in':
        throw new AppError(SessionErrors.SHARE_LINK_SIGN_IN_REQUIRED);
      case 'not_invited':
        throw new AppError(SessionErrors.SHARE_LINK_NOT_INVITED);
    }
    const loaded = await this.sessions.findOneByIdForMachine(link.sessionId);
    const session = loaded.isSome() ? loaded.unwrap() : null;
    if (!session || session.organizationId !== link.organizationId || session.isResolved) {
      throw new AppError(SessionErrors.SHARE_LINK_NOT_FOUND);
    }
    return { link, session };
  }
}
