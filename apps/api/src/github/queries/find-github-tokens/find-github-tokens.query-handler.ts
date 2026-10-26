import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { GithubTokenResolver } from '../../application/github-token.resolver';
import { GithubErrors } from '../../domain/github.errors';
import type { GithubTokenResponseDto } from '../../dtos/github-token.response.dto';
import { GithubTokenMapper } from '../../github-token.mapper';
import { FindGithubTokensQuery } from './find-github-tokens.query';

@QueryHandler(FindGithubTokensQuery)
export class FindGithubTokensQueryHandler
  implements IQueryHandler<FindGithubTokensQuery, GithubTokenResponseDto[]>
{
  constructor(
    private readonly tokens: GithubTokenResolver,
    private readonly mapper: GithubTokenMapper,
  ) {}

  async execute({ userId, tokenId }: FindGithubTokensQuery): Promise<GithubTokenResponseDto[]> {
    const now = new Date();
    const own = await this.tokens.findOwn(userId);
    const picked = tokenId === null ? own : own.filter((token) => token.id === tokenId);
    if (tokenId !== null && picked.length === 0) {
      throw new AppError(GithubErrors.TOKEN_NOT_FOUND, {
        detail: `No GitHub token with id ${tokenId}`,
      });
    }
    return picked.map((token) => this.mapper.toResponse(token, this.tokens.isUsable(token, now)));
  }
}
