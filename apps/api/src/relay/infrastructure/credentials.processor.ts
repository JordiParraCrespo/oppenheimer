import { Inject, Injectable, Logger } from '@nestjs/common';
import type { CredentialsTokenMessage } from '@oppenheimer/shared/protocol';
import type { RepositoryAccessPort } from '../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../github/github.di-tokens';
import type { HostKeyPort } from '../../hosts/application/host-key.port';
import { HOST_KEY } from '../../hosts/hosts.di-tokens';
import type { RunnerLink } from '../../links/application/link-registry.port';
import type { SessionLookupPort } from '../../sessions/application/session-lookup.port';
import { SESSION_LOOKUP } from '../../sessions/sessions.di-tokens';
import { seal } from './seal.util';

/**
 * `credentials.token` → `credentials.grant`: the runner asks for the
 * installation token for one session's repository, on the link, because the
 * link is the only channel already authenticated per host (01).
 *
 * Three checks before anything is minted: the session and checkout exist and
 * are live, the session runs on **this** link's host, and the repository the
 * runner names is the checkout's. Then the token is minted live — never cached,
 * so a repository removed from the installation stops on the next ask — and
 * sealed to the host's key, so the relay holds it in the clear for as long as
 * this function runs and no longer.
 *
 * A refusal is a `command.failed` carrying the ask's `requestId` and the
 * catalog code; the runner's credential helper turns that into git's "I have
 * none".
 */
@Injectable()
export class CredentialsProcessor {
  private readonly logger = new Logger(CredentialsProcessor.name);

  constructor(
    @Inject(SESSION_LOOKUP)
    private readonly sessions: SessionLookupPort,
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(HOST_KEY)
    private readonly keys: HostKeyPort,
  ) {}

  async onToken(link: RunnerLink, ask: CredentialsTokenMessage): Promise<void> {
    const target = await this.sessions.findCredentialTarget(ask.sessionId, ask.checkoutId);
    if (!target || target.hostId !== link.hostId || !target.live) {
      this.refuse(link, ask, 'SESSIONS_001', 'no such live checkout on this host');
      return;
    }
    if (target.githubRepoId !== ask.githubRepoId) {
      this.refuse(link, ask, 'SESSIONS_001', "the repository is not this checkout's");
      return;
    }
    const publicKey = await this.keys.publicKeyOf(link.hostId);
    if (!publicKey) {
      this.refuse(link, ask, 'HOSTS_001', 'host key unavailable');
      return;
    }
    try {
      const minted = await this.repositories.mintRepositoryToken(
        target.installationId,
        target.githubRepoId,
      );
      link.send({
        type: 'credentials.grant',
        requestId: ask.requestId,
        sessionId: ask.sessionId,
        checkoutId: ask.checkoutId,
        sealed: seal(publicKey, Buffer.from(minted.token, 'utf8')).toString('base64'),
        expiresAt: minted.expiresAt.toISOString(),
      });
    } catch (error) {
      const code = codeOf(error) ?? 'GITHUB_002';
      this.logger.warn({
        message: 'installation token could not be minted',
        hostId: link.hostId,
        code,
      });
      this.refuse(link, ask, code, 'the installation token could not be minted');
    }
  }

  private refuse(
    link: RunnerLink,
    ask: CredentialsTokenMessage,
    code: string,
    detail: string,
  ): void {
    link.send({ type: 'command.failed', commandId: ask.requestId, code, detail });
  }
}

function codeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code.length > 0 && code.length <= 32 ? code : null;
}
