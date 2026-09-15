import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import { API_TOKEN_REPOSITORY } from '../../api-tokens.di-tokens';
import type { ApiTokenRepositoryPort } from '../../database/api-token.repository.port';
import type { ApiTokenEntity } from '../../domain/api-token.entity';
import { ApiTokenErrors } from '../../domain/api-token.errors';
import { FindApiTokenByIdQuery } from './find-api-token-by-id.query';

@QueryHandler(FindApiTokenByIdQuery)
export class FindApiTokenByIdQueryHandler
  implements IQueryHandler<FindApiTokenByIdQuery, ApiTokenEntity>
{
  constructor(
    @Inject(API_TOKEN_REPOSITORY)
    private readonly apiTokens: ApiTokenRepositoryPort,
  ) {}

  async execute(query: FindApiTokenByIdQuery): Promise<ApiTokenEntity> {
    const found = await this.apiTokens.findOneById(query.tokenId);
    // A token belonging to someone else is reported as missing rather than
    // forbidden, so token ids cannot be probed for existence.
    if (found.isNone()) throw new AppError(ApiTokenErrors.NOT_FOUND);

    const token = found.unwrap();
    if (token.userId !== query.userId) throw new AppError(ApiTokenErrors.NOT_FOUND);

    return token;
  }
}
