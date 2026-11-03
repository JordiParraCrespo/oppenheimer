import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { SentryConnectionOrmEntity } from './database/sentry-connection.orm-entity';
import { SentryConnectionEntity } from './domain/sentry-connection.entity';
import { SentryConnectionResponseDto } from './dtos/sentry-connection.response.dto';

@Injectable()
export class SentryConnectionMapper
  implements Mapper<SentryConnectionEntity, SentryConnectionOrmEntity, SentryConnectionResponseDto>
{
  toPersistence(entity: SentryConnectionEntity): SentryConnectionOrmEntity {
    const record = new SentryConnectionOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.organizationSlug = entity.organizationSlug;
    record.sealedClientSecret = entity.sealedClientSecret;
    record.secretHint = entity.secretHint;
    record.createdByUserId = entity.createdByUserId;
    return record;
  }

  toDomain(record: SentryConnectionOrmEntity): SentryConnectionEntity {
    return SentryConnectionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        organizationSlug: record.organizationSlug,
        sealedClientSecret: record.sealedClientSecret,
        secretHint: record.secretHint,
        createdByUserId: record.createdByUserId,
      },
    });
  }

  /**
   * The webhook URL is the API's public origin (`BETTER_AUTH_URL`, handed in
   * by the caller), the versioned prefix and the connection's id.
   */
  toResponse(entity: SentryConnectionEntity, apiOrigin = ''): SentryConnectionResponseDto {
    const origin = apiOrigin.replace(/\/+$/, '');
    const dto = new SentryConnectionResponseDto();
    dto.id = entity.id;
    dto.organizationSlug = entity.organizationSlug;
    dto.secretHint = entity.secretHint;
    dto.webhookUrl = `${origin}/api/v1/sentry/webhooks/${entity.id}`;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }
}
