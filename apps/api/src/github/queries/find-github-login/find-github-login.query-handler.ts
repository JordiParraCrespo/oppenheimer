import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { PullRequestDirectoryPort } from '../../application/pull-request-directory.port';
import { PULL_REQUEST_DIRECTORY } from '../../github.di-tokens';
import { FindGithubLoginQuery } from './find-github-login.query';

/** The caller's GitHub login, or null when none is known (`PullRequestDirectoryPort.viewerLogin`). */
@QueryHandler(FindGithubLoginQuery)
export class FindGithubLoginQueryHandler
  implements IQueryHandler<FindGithubLoginQuery, string | null>
{
  constructor(
    @Inject(PULL_REQUEST_DIRECTORY)
    private readonly directory: PullRequestDirectoryPort,
  ) {}

  execute({ scope }: FindGithubLoginQuery): Promise<string | null> {
    return this.directory.viewerLogin(scope);
  }
}
