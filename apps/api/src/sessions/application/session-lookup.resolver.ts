import { Inject, Injectable } from '@nestjs/common';
import type { WorkSessionRepositoryPort } from '../database/work-session.repository.port';
import { WORK_SESSION_REPOSITORY } from '../sessions.di-tokens';
import type { SessionAttachTarget, SessionLookupPort } from './session-lookup.port';

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
}
