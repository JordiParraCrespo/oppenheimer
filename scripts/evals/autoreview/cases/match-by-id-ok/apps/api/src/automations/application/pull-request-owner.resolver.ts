import { Inject, Injectable } from '@nestjs/common';
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../sessions/database/session.repository.port';

export interface PullRequestRef {
  repositoryId: number;
  headRepositoryId: number;
  headBranch: string;
}

/**
 * Which bot opened a pull request, so a routine that reacts to pull requests
 * skips the ones its own bot's session opened. A branch name alone is not an
 * identity (a fork can push a branch of the same name), so the session must
 * be on the same repository by id as the pull request's head, and on its
 * branch.
 */
@Injectable()
export class PullRequestOwnerResolver {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async ownerBotOf(organizationId: string, pr: PullRequestRef): Promise<string | null> {
    if (pr.headRepositoryId !== pr.repositoryId) return null;
    const sessions = await this.sessions.findByRepositoryBranch(
      organizationId,
      pr.headRepositoryId,
      pr.headBranch,
    );
    return sessions.find((s) => s.botId !== null)?.botId ?? null;
  }
}
