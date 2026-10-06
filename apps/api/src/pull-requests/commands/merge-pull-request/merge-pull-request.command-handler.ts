import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
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
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  async execute({ scope, address, method }: MergePullRequestCommand): Promise<void> {
    await this.access.merge(scope, scope.userId, address, method);
  }
}
