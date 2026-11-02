import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AppError } from '@oppenheimer/backend-core';
import type { SentryConnectionRepositoryPort } from '../../database/sentry-connection.repository.port';
import { SentryErrors } from '../../domain/sentry.errors';
import type { SentryConnectionResponseDto } from '../../dtos/sentry-connection.response.dto';
import { SENTRY_CONNECTION_REPOSITORY } from '../../sentry.di-tokens';
import { SentryConnectionMapper } from '../../sentry-connection.mapper';
import { FindSentryConnectionQuery } from './find-sentry-connection.query';

@QueryHandler(FindSentryConnectionQuery)
export class FindSentryConnectionQueryHandler
  implements IQueryHandler<FindSentryConnectionQuery, SentryConnectionResponseDto>
{
  constructor(
    @Inject(SENTRY_CONNECTION_REPOSITORY)
    private readonly connections: SentryConnectionRepositoryPort,
    private readonly mapper: SentryConnectionMapper,
    private readonly config: ConfigService,
  ) {}

  async execute({ scope }: FindSentryConnectionQuery): Promise<SentryConnectionResponseDto> {
    const found = scope.organizationId
      ? await this.connections.findForOrganization(scope.organizationId)
      : null;
    if (!found || found.isNone()) throw new AppError(SentryErrors.NOT_CONNECTED);
    return this.mapper.toResponse(found.unwrap(), this.config.get<string>('app.betterAuthUrl'));
  }
}
