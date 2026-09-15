import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { ApiTokenOrmEntity } from './database/api-token.orm-entity';
import { ApiTokenEntity } from './domain/api-token.entity';
import { ApiTokenResponseDto } from './dtos/api-token.response.dto';

/**
 * Maps the API token aggregate between its domain, persistence and response
 * shapes. `toResponse` deliberately has no way to emit the secret: only the
 * create handler ever holds one, and it attaches it to its own response.
 */
@Injectable()
export class ApiTokenMapper
  implements Mapper<ApiTokenEntity, ApiTokenOrmEntity, ApiTokenResponseDto>
{
  toPersistence(entity: ApiTokenEntity): ApiTokenOrmEntity {
    const record = new ApiTokenOrmEntity();
    record.id = entity.id;
    record.userId = entity.userId;
    record.name = entity.name;
    record.prefix = entity.prefix;
    record.tokenHash = entity.tokenHash;
    record.scopes = entity.scopes;
    record.organizationIds = entity.organizationIds;
    record.ipAllowlist = entity.ipAllowlist;
    record.expiresAt = entity.expiresAt;
    record.lastUsedAt = entity.lastUsedAt;
    record.revokedAt = entity.revokedAt;
    return record;
  }

  toDomain(record: ApiTokenOrmEntity): ApiTokenEntity {
    return ApiTokenEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        userId: record.userId,
        name: record.name,
        prefix: record.prefix,
        tokenHash: record.tokenHash,
        scopes: record.scopes ?? [],
        organizationIds: record.organizationIds,
        ipAllowlist: record.ipAllowlist,
        expiresAt: record.expiresAt,
        lastUsedAt: record.lastUsedAt,
        revokedAt: record.revokedAt,
      },
    });
  }

  toResponse(entity: ApiTokenEntity): ApiTokenResponseDto {
    const dto = new ApiTokenResponseDto();
    dto.id = entity.id;
    dto.name = entity.name;
    dto.prefix = entity.prefix;
    dto.scopes = entity.scopes;
    dto.organizationIds = entity.organizationIds;
    dto.ipAllowlist = entity.ipAllowlist;
    dto.expiresAt = entity.expiresAt;
    dto.lastUsedAt = entity.lastUsedAt;
    dto.revokedAt = entity.revokedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
