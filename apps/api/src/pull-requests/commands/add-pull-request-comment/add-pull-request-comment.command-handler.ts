import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../../github/application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../../github/github.di-tokens';
import { AddPullRequestCommentCommand } from './add-pull-request-comment.command';

/** One line comment, posted at once in the caller's name, outside a review. */
@CommandHandler(AddPullRequestCommentCommand)
export class AddPullRequestCommentCommandHandler
  implements ICommandHandler<AddPullRequestCommentCommand, void>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  async execute({ scope, address, comment }: AddPullRequestCommentCommand): Promise<void> {
    await this.access.addComment(scope, scope.userId, address, comment);
  }
}
