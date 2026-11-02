import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { KeySealer } from '@oppenheimer/backend-core';
import type { SentryConnectionRepositoryPort } from '../../database/sentry-connection.repository.port';
import type { SentryStatusResponseDto } from '../../dtos/sentry-connection.response.dto';
import { SENTRY_CONNECTION_REPOSITORY, SENTRY_SECRET_SEALER } from '../../sentry.di-tokens';
import { SentryConnectionMapper } from '../../sentry-connection.mapper';
import { FindSentryConnectionQuery } from './find-sentry-connection.query';

@QueryHandler(FindSentryConnectionQuery)
export class FindSentryConnectionQueryHandler
  implements IQueryHandler<FindSentryConnectionQuery, SentryStatusResponseDto>
{
  constructor(
    @Inject(SENTRY_CONNECTION_REPOSITORY)
    private readonly connections: SentryConnectionRepositoryPort,
    @Inject(SENTRY_SECRET_SEALER) private readonly sealer: KeySealer,
    private readonly mapper: SentryConnectionMapper,
    private readonly config: ConfigService,
  ) {}

  async execute({ scope }: FindSentryConnectionQuery): Promise<SentryStatusResponseDto> {
    const found = scope.organizationId
      ? await this.connections.findForOrganization(scope.organizationId)
      : null;
    const origin = this.config.get<string>('app.betterAuthUrl');
    return {
      configured: this.sealer.isConfigured(),
      connection: found?.isSome() ? this.mapper.toResponse(found.unwrap(), origin) : null,
    };
  }
}
