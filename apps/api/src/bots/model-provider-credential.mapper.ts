import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { BOT_PROVIDERS, type BotProvider } from '@oppenheimer/shared';
import { ModelProviderCredentialOrmEntity } from './database/model-provider-credential.orm-entity';
import type { ChatgptLoginFlow } from './domain/chatgpt-login.policy';
import { ModelProviderCredentialEntity } from './domain/model-provider-credential.entity';
import {
  ChatgptLoginResponseDto,
  ChatgptLoginStatusResponseDto,
} from './dtos/chatgpt-login.response.dto';
import { ModelProviderCredentialResponseDto } from './dtos/model-provider-credential.response.dto';
import type { ChatgptDeviceCode, ChatgptTokens } from './infrastructure/chatgpt-auth.port';

/** The fields of a JSON object, or none. */
function recordOf(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringsOf<K extends string>(
  record: Record<string, unknown>,
  keys: readonly K[],
): Record<K, string> | null {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string' || value.length === 0) return null;
    out[key] = value;
  }
  return out;
}

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

  /**
   * What a ChatGPT credential seals in place of a key: the sign-in's tokens as
   * one JSON text, the expiry in epoch milliseconds.
   */
  toChatgptSecret(tokens: ChatgptTokens): string {
    return JSON.stringify({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.getTime(),
      accountId: tokens.accountId,
    });
  }

  /** The tokens a ChatGPT credential's opened secret holds; null for one that is not that shape. */
  chatgptTokensOf(secret: string): ChatgptTokens | null {
    const record = recordOf(secret);
    const strings = stringsOf(record, ['accessToken', 'refreshToken', 'accountId'] as const);
    if (!strings || typeof record.expiresAt !== 'number') return null;
    return { ...strings, expiresAt: new Date(record.expiresAt) };
  }

  /** A sign-in in progress as the text that is sealed into its `flowId`. */
  toChatgptLoginFlow(flow: ChatgptLoginFlow): string {
    return JSON.stringify({
      deviceAuthId: flow.deviceAuthId,
      userCode: flow.userCode,
      organizationId: flow.organizationId,
      expiresAt: flow.expiresAt.getTime(),
    });
  }

  /** The sign-in an opened `flowId` holds; null for text that is not one. */
  chatgptLoginFlowOf(text: string): ChatgptLoginFlow | null {
    const record = recordOf(text);
    const strings = stringsOf(record, ['deviceAuthId', 'userCode', 'organizationId'] as const);
    if (!strings || typeof record.expiresAt !== 'number') return null;
    return { ...strings, expiresAt: new Date(record.expiresAt) };
  }

  /** What the console gets to show a started sign-in: never the device code's own id, except sealed. */
  toChatgptLoginResponse(
    flowId: string,
    code: ChatgptDeviceCode,
    expiresAt: Date,
  ): ChatgptLoginResponseDto {
    const dto = new ChatgptLoginResponseDto();
    dto.flowId = flowId;
    dto.userCode = code.userCode;
    dto.verificationUrl = code.verificationUrl;
    dto.intervalSeconds = code.intervalSeconds;
    dto.expiresAt = expiresAt.toISOString();
    return dto;
  }

  toChatgptLoginStatusResponse(connected: boolean): ChatgptLoginStatusResponseDto {
    const dto = new ChatgptLoginStatusResponseDto();
    dto.status = connected ? 'connected' : 'pending';
    return dto;
  }
}
