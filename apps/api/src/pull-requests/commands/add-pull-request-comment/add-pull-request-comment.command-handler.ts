import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { PullRequestWritePort } from '../../../github/application/pull-request-write.port';
import { PULL_REQUEST_WRITES } from '../../../github/github.di-tokens';
import { requireApp } from '../../application/app-address.policy';
import { AddPullRequestCommentCommand } from './add-pull-request-comment.command';

/** One line comment, posted at once in the caller's name, outside a review. */
@CommandHandler(AddPullRequestCommentCommand)
export class AddPullRequestCommentCommandHandler
  implements ICommandHandler<AddPullRequestCommentCommand, void>
{
  constructor(
    @Inject(PULL_REQUEST_WRITES)
    private readonly writes: PullRequestWritePort,
  ) {}

  async execute({ scope, address, comment }: AddPullRequestCommentCommand): Promise<void> {
    await this.writes.addComment(scope, scope.userId, requireApp(address), comment);
  }
}
