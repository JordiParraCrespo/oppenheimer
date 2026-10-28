import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import {
  CLOUD_AGENT_PROVIDER_LABELS,
  CLOUD_AGENT_PROVIDERS,
  type CloudAgentProviderId,
} from '@oppenheimer/shared';
import { CloudAgentCredentialOrmEntity } from './database/cloud-agent-credential.orm-entity';
import { CloudAgentCredentialEntity } from './domain/cloud-agent-credential.entity';
import {
  CloudAgentProviderStatusDto,
  CloudAgentStatusResponseDto,
} from './dtos/cloud-agent-status.response.dto';

@Injectable()
export class CloudAgentCredentialMapper
  implements
    Mapper<CloudAgentCredentialEntity, CloudAgentCredentialOrmEntity, CloudAgentProviderStatusDto>
{
  toPersistence(entity: CloudAgentCredentialEntity): CloudAgentCredentialOrmEntity {
    const record = new CloudAgentCredentialOrmEntity();
    record.id = entity.id;
    record.organizationId = entity.organizationId;
    record.userId = entity.userId;
    record.provider = entity.provider;
    record.sealedKey = entity.sealedKey;
    record.keyHint = entity.keyHint;
    record.keyName = entity.keyName;
    record.accountEmail = entity.accountEmail;
    record.accountId = entity.accountId;
    return record;
  }

  toDomain(record: CloudAgentCredentialOrmEntity): CloudAgentCredentialEntity {
    return CloudAgentCredentialEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        organizationId: record.organizationId,
        userId: record.userId,
        provider: record.provider,
        sealedKey: record.sealedKey,
        keyHint: record.keyHint,
        keyName: record.keyName,
        accountEmail: record.accountEmail,
        accountId: record.accountId,
      },
    });
  }

  /** Never the key: whose it is, and its last four characters. */
  toResponse(entity: CloudAgentCredentialEntity): CloudAgentProviderStatusDto {
    return this.row(entity.provider, entity);
  }

  /**
   * Every vendor in order, connected or not. `configured` is the server's;
   * a key is only usable on a server that can open it.
   */
  toStatus(
    credentials: readonly CloudAgentCredentialEntity[],
    configured: boolean,
  ): CloudAgentStatusResponseDto {
    const dto = new CloudAgentStatusResponseDto();
    dto.configured = configured;
    dto.providers = CLOUD_AGENT_PROVIDERS.map((provider) =>
      this.row(
        provider,
        configured ? credentials.find((row) => row.provider === provider) : undefined,
      ),
    );
    dto.available = dto.providers.some((row) => row.connected);
    return dto;
  }

  private row(
    provider: CloudAgentProviderId,
    credential: CloudAgentCredentialEntity | undefined,
  ): CloudAgentProviderStatusDto {
    const dto = new CloudAgentProviderStatusDto();
    dto.id = provider;
    dto.label = CLOUD_AGENT_PROVIDER_LABELS[provider];
    dto.connected = Boolean(credential);
    dto.keyName = credential?.keyName ?? null;
    dto.keyHint = credential?.keyHint ?? null;
    dto.accountEmail = credential?.accountEmail ?? null;
    dto.connectedAt = credential ? credential.updatedAt.toISOString() : null;
    return dto;
  }
}
