import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { API_TOKEN_REPOSITORY } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import type { ApiTokenEntity } from '../../domain/api-token.entity';
import { FindApiTokensQuery } from './find-api-tokens.query';

@QueryHandler(FindApiTokensQuery)
export class FindApiTokensQueryHandler
  implements IQueryHandler<FindApiTokensQuery, ApiTokenEntity[]>
{
  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
  ) {}

  execute(query: FindApiTokensQuery): Promise<ApiTokenEntity[]> {
    return this.apiTokens.findByUserId(query.userId);
  }
}
