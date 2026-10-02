import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { RepositoryAccessPort } from '../../../github/application/repository-access.port';
import { REPOSITORY_ACCESS } from '../../../github/github.di-tokens';
import type { HostAccessPort } from '../../../hosts/application/host-access.port';
import type { HostKeyPort } from '../../../hosts/application/host-key.port';
import { HOST_ACCESS, HOST_KEY } from '../../../hosts/hosts.di-tokens';
import type { SessionDispatchPort } from '../../application/session-dispatch.port';
import { SESSION_DISPATCH } from '../../sessions.di-tokens';
import { PrepareSessionCommand } from './prepare-session.command';

export interface PrepareSessionResult {
  hints: string[];
}

/**
 * Gets a host ready for the session a person is composing: each repository
 * cloned or fetched there and a spare worktree made, so the create that follows
 * cuts a branch from a checkout that already exists (02 §5).
 *
 * The checks are a create's — a host the caller may use, a repository the
 * installation covers — and nothing is written. The token the host's git needs
 * is minted here for that repository alone and sealed to the host's key before
 * it leaves: a credential ask names a session, and there is none yet. A host that is offline, or whose runner predates the frame, gets
 * nothing and the create does the work as it always has.
 */
@CommandHandler(PrepareSessionCommand)
export class PrepareSessionCommandHandler
  implements ICommandHandler<PrepareSessionCommand, PrepareSessionResult>
{
  constructor(
    @Inject(HOST_ACCESS)
    private readonly hosts: HostAccessPort,
    @Inject(HOST_KEY)
    private readonly keys: HostKeyPort,
    @Inject(REPOSITORY_ACCESS)
    private readonly repositories: RepositoryAccessPort,
    @Inject(SESSION_DISPATCH)
    private readonly dispatch: SessionDispatchPort,
  ) {}

  async execute(command: PrepareSessionCommand): Promise<PrepareSessionResult> {
    const { scope, input } = command;
    await this.hosts.assertUsable(scope, input.hostId);
    // Asked before a token is minted: a host that cannot take one gets none.
    const refusal = this.dispatch.prepareRefusal(input.hostId);
    if (refusal) return { hints: [refusal] };
    if (!(await this.keys.publicKeyOf(input.hostId))) return { hints: ['host_offline'] };

    const hints = new Set<string>();
    for (const checkout of input.checkouts) {
      const repository = await this.repositories.repositoryOf(
        scope,
        checkout.installationId,
        checkout.githubRepoId,
      );
      const minted = await this.repositories.mintRepositoryToken(
        checkout.installationId,
        checkout.githubRepoId,
      );
      const sealed = await this.keys.sealFor(input.hostId, Buffer.from(minted.token, 'utf8'));
      if (!sealed) return { hints: ['host_offline'] };
      const outcome = this.dispatch.prepare(input.hostId, {
        githubRepoId: checkout.githubRepoId,
        repositoryFullName: repository.fullName,
        baseBranch: checkout.baseBranch ?? repository.defaultBranch,
        sealed,
        expiresAt: minted.expiresAt,
      });
      for (const hint of outcome.hints) hints.add(hint);
    }
    return { hints: [...hints] };
  }
}
