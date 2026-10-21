import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../application/issue-access.port';
import { ISSUE_ACCESS } from '../../github.di-tokens';
import { AddIssueCommentCommand } from './add-issue-comment.command';

/** One conversation comment, posted at once in the caller's name; answers its link. */
@CommandHandler(AddIssueCommentCommand)
export class AddIssueCommentCommandHandler
  implements ICommandHandler<AddIssueCommentCommand, { htmlUrl: string }>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly access: IssueAccessPort,
  ) {}

  execute({ scope, address, body }: AddIssueCommentCommand): Promise<{ htmlUrl: string }> {
    return this.access.addComment(scope, scope.userId, address, body);
  }
}
