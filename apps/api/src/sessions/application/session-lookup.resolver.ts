import { Inject, Injectable } from '@nestjs/common';
import type { SessionShareLinkRepositoryPort } from '../database/session-share-link.repository.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import type { ShareLinkViewer } from '../domain/session-share-link.entity';
import { SESSION_SHARE_LINK_REPOSITORY, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type {
  SessionAttachTarget,
  SessionCredentialTarget,
  SessionLookupPort,
} from './session-lookup.port';

@Injectable()
export class SessionLookupResolver implements SessionLookupPort {
  constructor(
    @Inject(WORK_SESSION_REPOSITORY)
    private readonly sessions: WorkSessionRepositoryPort,
    @Inject(SESSION_SHARE_LINK_REPOSITORY)
    private readonly links: SessionShareLinkRepositoryPort,
  ) {}

  async shareLinkAdmits(
    linkId: string,
    sessionId: string,
    viewer: ShareLinkViewer | null,
  ): Promise<boolean> {
    const found = await this.links.findOneById(linkId);
    if (found.isNone()) return false;
    const link = found.unwrap();
    return link.sessionId === sessionId && link.refusalFor(viewer) === null;
  }

  async findAttachTarget(sessionId: string): Promise<SessionAttachTarget | null> {
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isNone()) return null;
    const session = found.unwrap();
    return {
      id: session.id,
      organizationId: session.organizationId,
      hostId: session.hostId,
      state: session.isResolved ? 'resolved' : session.stoppedAt !== null ? 'stopped' : 'live',
    };
  }

  async findCredentialTarget(
    sessionId: string,
    checkoutId: string,
  ): Promise<SessionCredentialTarget | null> {
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isNone()) return null;
    const session = found.unwrap();
    const checkout = session.checkouts.find((candidate) => candidate.id === checkoutId);
    if (!checkout) return null;
    return {
      hostId: session.hostId,
      installationId: checkout.installationId,
      githubRepoId: Number(checkout.githubRepoId),
      live: !session.isResolved && !checkout.isRemoved,
      createdByUserId: session.createdByUserId,
    };
  }
}
