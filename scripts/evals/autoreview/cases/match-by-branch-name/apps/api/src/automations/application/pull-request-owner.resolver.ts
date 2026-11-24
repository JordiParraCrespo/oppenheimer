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
 * skips the ones its own bot's session opened. A session pushes its work to
 * its branch, so the bot is the one whose session is on the pull request's
 * head branch.
 */
@Injectable()
export class PullRequestOwnerResolver {
  constructor(@Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort) {}

  async ownerBotOf(organizationId: string, pr: PullRequestRef): Promise<string | null> {
    const sessions = await this.sessions.findByBranch(organizationId, pr.headBranch);
    return sessions.find((s) => s.botId !== null)?.botId ?? null;
  }
}
