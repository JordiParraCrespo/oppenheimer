import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../application/issue-access.port';
import { ISSUE_ACCESS } from '../../github.di-tokens';
import { AddAppIssueCommentCommand } from './add-app-issue-comment.command';

/** One conversation comment, posted at once as the App; answers its link. */
@CommandHandler(AddAppIssueCommentCommand)
export class AddAppIssueCommentCommandHandler
  implements ICommandHandler<AddAppIssueCommentCommand, { htmlUrl: string }>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly access: IssueAccessPort,
  ) {}

  execute({ scope, address, body }: AddAppIssueCommentCommand): Promise<{ htmlUrl: string }> {
    return this.access.addAppComment(scope, address, body);
  }
}
