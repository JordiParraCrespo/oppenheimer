import { Inject, Injectable } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
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
  ) {}

  async findAttachTarget(sessionId: string): Promise<SessionAttachTarget | null> {
    const found = await this.sessions.findOneByIdForMachine(sessionId);
    if (found.isNone()) return null;
    const session = found.unwrap();
    return {
      id: session.id,
      organizationId: session.organizationId,
      hostId: session.hostId,
      attachable: !session.isResolved && session.stoppedAt === null,
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
    };
  }
}
