import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { PullRequestWritePort } from '../../../github/application/pull-request-write.port';
import { PULL_REQUEST_WRITES } from '../../../github/github.di-tokens';
import { MergePullRequestCommand } from './merge-pull-request.command';

/**
 * Merges in the caller's own name, at the head they saw. GitHub's branch rules
 * are the gate: a refusal is `GITHUB_014`, and nothing is bypassed or retried.
 */
@CommandHandler(MergePullRequestCommand)
export class MergePullRequestCommandHandler
  implements ICommandHandler<MergePullRequestCommand, void>
{
  constructor(
    @Inject(PULL_REQUEST_WRITES)
    private readonly writes: PullRequestWritePort,
  ) {}

  async execute({
    scope,
    address,
    method,
    expectedHeadSha,
  }: MergePullRequestCommand): Promise<void> {
    const app = this.writes.requireApp(address);
    await this.writes.merge(scope, scope.userId, app, method, expectedHeadSha);
  }
}
