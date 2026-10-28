import { Injectable } from '@nestjs/common';
import type { WorkSessionEntity } from '../domain/work-session.entity';
import { RepositoryTokenFactory } from './repository-token.factory';
import type { SessionLaunchSpec } from './session-dispatch.port';

/**
 * What a launch must carry for its host to fetch on its own, by place. A
 * worktree or folder session carries nothing: its git asks for a token by the
 * live checkout it is working in. A cloud session leaves no checkout on the
 * host to ask by, so it carries its one repository's token sealed in, and is
 * held back while the host has no key to seal to.
 */
@Injectable()
export class SessionLaunchCredentials {
  constructor(private readonly tokens: RepositoryTokenFactory) {}

  async for(session: WorkSessionEntity): Promise<Pick<SessionLaunchSpec, 'cloud' | 'withheld'>> {
    // A cloud session no host starts (Cursor's) is never launched by a host.
    const hostId = session.hostId;
    if (session.place !== 'cloud' || hostId === null) return {};
    const checkout = session.liveCheckouts[0];
    if (!checkout) return {};
    const token = await this.tokens.sealed(
      hostId,
      checkout.installationId,
      Number(checkout.githubRepoId),
    );
    return token ? { cloud: token } : { withheld: 'host_offline' };
  }
}
