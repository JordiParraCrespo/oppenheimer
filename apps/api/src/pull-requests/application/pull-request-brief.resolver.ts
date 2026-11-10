import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AccessScope } from '@oppenheimer/backend-authz';
import { CacheService } from '@oppenheimer/backend-cache';
import { LlmService } from '@oppenheimer/backend-llm';
import type { PullRequestAddress } from '../../github/application/pull-request-access.port';
import type { PullRequestReadPort } from '../../github/application/pull-request-read.port';
import { PULL_REQUEST_READS } from '../../github/github.di-tokens';
import {
  briefRequest,
  type PullRequestBriefText,
  parseModelBrief,
} from '../domain/pull-request-brief.policy';

/** A brief describes one commit, so it is kept until long after anyone reads that commit. */
const BRIEF_TTL_SECONDS = 14 * 24 * 60 * 60;
/** A card waits this long for the model before the description stands in. */
const BRIEF_TIMEOUT_MS = 20_000;

/**
 * The model's brief of a pull request's head commit, or null when there is no
 * model or it gave none: the caller then reads the description instead.
 *
 * Written once per head commit and kept (`pull-brief:` in the cache), so a
 * deck walked twice, or by a second tab, asks the model once. The key names
 * the workspace: a brief quotes private code, and the read that reaches this
 * resolver has already proved the caller may see the pull request. A failure
 * is not kept, so the next card view asks again.
 */
@Injectable()
export class PullRequestBriefResolver {
  private readonly logger = new Logger(PullRequestBriefResolver.name);

  constructor(
    @Inject(PULL_REQUEST_READS)
    private readonly reads: PullRequestReadPort,
    private readonly llm: LlmService,
    private readonly cache: CacheService,
  ) {}

  async modelBrief(
    scope: AccessScope,
    address: PullRequestAddress,
    pull: { title: string; body: string; headSha: string },
  ): Promise<PullRequestBriefText | null> {
    if (!this.llm.isConfigured()) return null;
    const key = `pull-brief:${scope.organizationId}:${address.githubRepoId}:${address.number}:${pull.headSha}`;
    try {
      return await this.cache.getOrSet(key, BRIEF_TTL_SECONDS, async () => {
        const files = await this.reads.files(scope, address);
        const completion = await this.llm.complete({
          ...briefRequest({ title: pull.title, body: pull.body, files }),
          timeoutMs: BRIEF_TIMEOUT_MS,
        });
        const brief = parseModelBrief(completion.text);
        if (!brief) throw new Error('the model answered something that is not a brief');
        return brief;
      });
    } catch (error) {
      this.logger.warn({
        message: 'No model brief; the description stands in',
        githubRepoId: address.githubRepoId,
        number: address.number,
        reason: (error as Error).message,
      });
      return null;
    }
  }
}
