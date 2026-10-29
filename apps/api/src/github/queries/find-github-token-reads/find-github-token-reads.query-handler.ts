import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import type { GithubTokenReadsResponseDto } from '../../dtos/github-token.response.dto';
import { GithubTokenMapper } from '../../github-token.mapper';
import { FindGithubTokenReadsQuery } from './find-github-token-reads.query';

@QueryHandler(FindGithubTokenReadsQuery)
export class FindGithubTokenReadsQueryHandler
  implements IQueryHandler<FindGithubTokenReadsQuery, GithubTokenReadsResponseDto[]>
{
  constructor(
    private readonly tokens: GithubTokenResolver,
    private readonly mapper: GithubTokenMapper,
  ) {}

  async execute({ userId }: FindGithubTokenReadsQuery): Promise<GithubTokenReadsResponseDto[]> {
    const repositories = await this.tokens.repositoriesOf(userId, new Date());
    return repositories
      .map((repository) => this.mapper.toReads(repository))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }
}
