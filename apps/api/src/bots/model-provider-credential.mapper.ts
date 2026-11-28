import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { MODEL_PROVIDERS, type ModelProvider } from '@oppenheimer/shared';
import { ModelProviderCredentialOrmEntity } from './database/model-provider-credential.orm-entity';
import { ModelProviderCredentialEntity } from './domain/model-provider-credential.entity';
import { defaultBotProvider } from './domain/model-provider-default.policy';
import { keysInStoredOrder } from './domain/model-provider-key-order.policy';
import {
  ModelProviderCredentialResponseDto,
  ModelProviderKeyResponseDto,
} from './dtos/model-provider-credential.response.dto';

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
    record.markedDefault = entity.markedDefault;
    record.position = entity.position;
    record.spentAt = entity.spentAt;
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
        provider: record.provider as ModelProvider,
        sealedKey: record.sealedKey,
        keyHint: record.keyHint,
        updatedByUserId: record.updatedByUserId,
        markedDefault: record.markedDefault,
        position: record.position,
        spentAt: record.spentAt,
      },
    });
  }

  /**
   * What the console may know of a key: that it is there, its last characters,
   * when, and whether new bots start on it. Never the key. `isDefault` is the
   * resolved default (`defaultBotProvider`), never the stored mark: the list
   * passes it, and a key read on its own is resolved as the only one.
   */
  toResponse(
    entity: ModelProviderCredentialEntity,
    isDefault = defaultBotProvider([entity]) === entity.provider,
  ): ModelProviderCredentialResponseDto {
    return this.toProviderResponse([entity], isDefault);
  }

  /**
   * Every provider, the speech-only ones after the bots', in catalog order, each with the
   * workspace's stored keys when it has any and as "no key" when it has none. Exactly one is
   * the default: the provider a new bot starts on (`defaultBotProvider`).
   */
  toResponseList(
    credentials: readonly ModelProviderCredentialEntity[],
  ): ModelProviderCredentialResponseDto[] {
    const byProvider = new Map<ModelProvider, ModelProviderCredentialEntity[]>();
    for (const row of credentials) {
      byProvider.set(row.provider, [...(byProvider.get(row.provider) ?? []), row]);
    }
    const fallback = defaultBotProvider(credentials);
    return MODEL_PROVIDERS.map((provider) => {
      const keys = byProvider.get(provider);
      const isDefault = provider === fallback;
      return keys
        ? this.toProviderResponse(keys, isDefault)
        : this.toMissingResponse(provider, isDefault);
    });
  }

  /** A provider's stored keys, in their stored order; the provider's own fields read off the first. */
  private toProviderResponse(
    keys: readonly ModelProviderCredentialEntity[],
    isDefault: boolean,
  ): ModelProviderCredentialResponseDto {
    const ordered = keysInStoredOrder(keys);
    const first = ordered[0];
    const dto = new ModelProviderCredentialResponseDto();
    dto.provider = first.provider;
    dto.configured = true;
    dto.keyHint = first.keyHint;
    dto.updatedAt = first.updatedAt.toISOString();
    dto.isDefault = isDefault;
    dto.keys = ordered.map((key) => this.toKeyResponse(key));
    return dto;
  }

  private toKeyResponse(entity: ModelProviderCredentialEntity): ModelProviderKeyResponseDto {
    const dto = new ModelProviderKeyResponseDto();
    dto.id = entity.id;
    dto.keyHint = entity.keyHint;
    dto.spentAt = entity.spentAt?.toISOString() ?? null;
    dto.updatedAt = entity.updatedAt.toISOString();
    return dto;
  }

  /** A provider with no key stored. */
  private toMissingResponse(
    provider: ModelProvider,
    isDefault: boolean,
  ): ModelProviderCredentialResponseDto {
    const dto = new ModelProviderCredentialResponseDto();
    dto.provider = provider;
    dto.configured = false;
    dto.keyHint = null;
    dto.updatedAt = null;
    dto.isDefault = isDefault;
    dto.keys = [];
    return dto;
  }
}
