import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../../github/application/issue-access.port';
import { ISSUE_ACCESS } from '../../../github/github.di-tokens';
import { AddPullRequestConversationCommentCommand } from './add-pull-request-conversation-comment.command';

/**
 * One comment on a pull request's conversation, posted at once in the
 * caller's name; answers its link. GitHub keeps a pull request's
 * conversation on its issue, so the comment goes through the issue access.
 */
@CommandHandler(AddPullRequestConversationCommentCommand)
export class AddPullRequestConversationCommentCommandHandler
  implements ICommandHandler<AddPullRequestConversationCommentCommand, { htmlUrl: string }>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly issues: IssueAccessPort,
  ) {}

  execute({
    scope,
    address,
    body,
  }: AddPullRequestConversationCommentCommand): Promise<{ htmlUrl: string }> {
    return this.issues.addComment(scope, scope.userId, address, body);
  }
}
