import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { PullRequestAccessPort } from '../../application/pull-request-access.port';
import { PULL_REQUEST_ACCESS } from '../../github.di-tokens';
import { AddIssueCommentCommand } from './add-issue-comment.command';

/** One conversation comment, posted at once in the caller's name; answers its link. */
@CommandHandler(AddIssueCommentCommand)
export class AddIssueCommentCommandHandler
  implements ICommandHandler<AddIssueCommentCommand, { htmlUrl: string }>
{
  constructor(
    @Inject(PULL_REQUEST_ACCESS)
    private readonly access: PullRequestAccessPort,
  ) {}

  execute({ scope, address, body }: AddIssueCommentCommand): Promise<{ htmlUrl: string }> {
    return this.access.addIssueComment(scope, scope.userId, address, body);
  }
}
