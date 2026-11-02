import { Inject, Injectable } from '@nestjs/common';
import type { SessionShareRepositoryPort } from '../database/session-share.repository.port';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import type { SessionShareViewer } from '../domain/session-share.entity';
import { SESSION_SHARE_REPOSITORY, WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
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
    @Inject(SESSION_SHARE_REPOSITORY)
    private readonly shares: SessionShareRepositoryPort,
  ) {}

  async shareAdmits(
    shareId: string,
    sessionId: string,
    sharedByUserId: string,
    viewer: SessionShareViewer,
    readOnly: boolean,
  ): Promise<boolean> {
    const found = await this.shares.findOneById(shareId);
    if (found.isNone()) return false;
    const share = found.unwrap();
    if (share.sessionId !== sessionId || share.sharedByUserId !== sharedByUserId) return false;
    if (share.refusalFor(viewer) !== null) return false;
    return readOnly || !share.readOnly;
  }

  async findAttachTarget(sessionId: string): Promise<SessionAttachTarget | null> {
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isNone()) return null;
    const session = found.unwrap();
    // A cloud session has no terminal of ours to attach to.
    if (session.hostId === null) return null;
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
    if (!checkout || session.hostId === null) return null;
    return {
      hostId: session.hostId,
      installationId: checkout.installationId,
      githubRepoId: Number(checkout.githubRepoId),
      live: !session.isResolved && !checkout.isRemoved,
      createdByUserId: session.createdByUserId,
    };
  }
}
