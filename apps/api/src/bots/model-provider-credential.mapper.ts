import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BOT_PROVIDERS, type BotProvider } from '@oppenheimer/shared';
import { ModelProviderCredentialOrmEntity } from './database/model-provider-credential.orm-entity';
import { ModelProviderCredentialEntity } from './domain/model-provider-credential.entity';
import { ModelProviderCredentialResponseDto } from './dtos/model-provider-credential.response.dto';

@Injectable()
export class ModelProviderCredentialMapper
  implements
    Mapper<
      ModelProviderCredentialEntity,
      ModelProviderCredentialOrmEntity,
      ModelProviderCredentialResponseDto
    >
{
  toPersistence(entity: ModelProviderCredentialEntity): ModelProviderCredentialOrmEntity {
    const record = new ModelProviderCredentialOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.provider = entity.provider;
    record.sealedKey = entity.sealedKey;
    record.keyHint = entity.keyHint;
    record.updatedByUserId = entity.updatedByUserId;
    record.updatedAt = entity.updatedAt;
    return record;
  }

  toDomain(record: ModelProviderCredentialOrmEntity): ModelProviderCredentialEntity {
    return ModelProviderCredentialEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        provider: record.provider as BotProvider,
        sealedKey: record.sealedKey,
        keyHint: record.keyHint,
        updatedByUserId: record.updatedByUserId,
      },
    });
  }

  /** What the console may know of a key: that it is there, its last characters, when. Never the key. */
  toResponse(entity: ModelProviderCredentialEntity): ModelProviderCredentialResponseDto {
    const dto = new ModelProviderCredentialResponseDto();
    dto.provider = entity.provider;
    dto.configured = true;
    dto.keyHint = entity.keyHint;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }

  /**
   * Every provider a bot can run on, in catalog order, each from the workspace's
   * stored key when it has one and as "no key" when it has none.
   */
  toResponseList(
    credentials: readonly ModelProviderCredentialEntity[],
  ): ModelProviderCredentialResponseDto[] {
    const byProvider = new Map(credentials.map((row) => [row.provider, row]));
    return BOT_PROVIDERS.map((provider) => {
      const credential = byProvider.get(provider);
      return credential ? this.toResponse(credential) : this.toMissingResponse(provider);
    });
  }

  /** A provider with no key stored. */
  private toMissingResponse(provider: BotProvider): ModelProviderCredentialResponseDto {
    const dto = new ModelProviderCredentialResponseDto();
    dto.provider = provider;
    dto.configured = false;
    dto.keyHint = null;
    dto.updatedAt = null;
    return dto;
  }
}
