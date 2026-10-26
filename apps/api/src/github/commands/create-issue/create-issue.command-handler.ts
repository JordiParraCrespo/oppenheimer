import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import type { IssueAccessPort } from '../../application/issue-access.port';
import { ISSUE_ACCESS } from '../../github.di-tokens';
import { type CreatedIssue, CreateIssueCommand } from './create-issue.command';

/** Opens an issue in the caller's own name, through their GitHub user token. */
@CommandHandler(CreateIssueCommand)
export class CreateIssueCommandHandler
  implements ICommandHandler<CreateIssueCommand, CreatedIssue>
{
  constructor(
    @Inject(ISSUE_ACCESS)
    private readonly access: IssueAccessPort,
  ) {}

  async execute({ scope, repository, issue }: CreateIssueCommand): Promise<CreatedIssue> {
    const created = await this.access.createIssue(scope, scope.userId, repository, issue);
    return { number: created.number, htmlUrl: created.htmlUrl };
  }
}
