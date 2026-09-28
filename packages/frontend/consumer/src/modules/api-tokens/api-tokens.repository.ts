import { type ApiTokenResponseDto, heyApiSdk } from '@oppenheimer/api-client';
import { MapApiError, unwrap, unwrapBody } from '@oppenheimer/frontend-core';
import type { CreateApiTokenDto } from '@oppenheimer/shared';
import { injectable } from 'inversify';
import {
  ApiTokenEntity,
  type CreatedApiToken,
  type CurrentCredential,
  type PermissionCatalog,
} from './api-token.entity';
import { ApiTokensErrors } from './api-tokens.errors';

function toEntity(data: ApiTokenResponseDto): ApiTokenEntity {
  return new ApiTokenEntity(
    data.id,
    data.name,
    data.prefix,
    data.scopes,
    data.organizationIds,
    data.ipAllowlist,
    toDate(data.expiresAt),
    toDate(data.lastUsedAt),
    toDate(data.revokedAt),
    new Date(data.createdAt),
  );
}

function toDate(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

@injectable()
export class ApiTokensRepository {
  @MapApiError(ApiTokensErrors.FETCH_LIST_FAILED)
  async findAll(): Promise<ApiTokenEntity[]> {
    const result = await unwrapBody(heyApiSdk.findApiTokens(), ApiTokensErrors.FETCH_LIST_FAILED);
    return result.map(toEntity);
  }

  @MapApiError(ApiTokensErrors.CREATE_FAILED)
  async create(dto: CreateApiTokenDto): Promise<CreatedApiToken> {
    const result = await unwrapBody(
      heyApiSdk.createApiToken({ body: dto }),
      ApiTokensErrors.CREATE_FAILED,
    );

    return { token: toEntity(result), secret: result.token };
  }

  @MapApiError(ApiTokensErrors.REVOKE_FAILED)
  async revoke(id: string): Promise<void> {
    await unwrap(heyApiSdk.revokeApiToken({ path: { id } }), ApiTokensErrors.REVOKE_FAILED);
  }

  /**
   * The permission catalog plus the subset the caller may grant. Only the
   * server can answer the second part — it depends on the caller's roles.
   */
  @MapApiError(ApiTokensErrors.FETCH_PERMISSIONS_FAILED)
  async permissions(): Promise<PermissionCatalog> {
    const result = await unwrapBody(
      heyApiSdk.findGrantablePermissions(),
      ApiTokensErrors.FETCH_PERMISSIONS_FAILED,
    );

    return { groups: result.groups, grantable: result.grantable };
  }

  @MapApiError(ApiTokensErrors.FETCH_CREDENTIAL_FAILED)
  async currentCredential(): Promise<CurrentCredential> {
    const result = await unwrapBody(
      heyApiSdk.findCurrentCredential(),
      ApiTokensErrors.FETCH_CREDENTIAL_FAILED,
    );

    return {
      kind: result.kind,
      userId: result.userId,
      email: result.email,
      grantedScopes: result.grantedScopes,
      effectiveScopes: result.effectiveScopes,
      organizationIds: result.organizationIds,
      expiresAt: toDate(result.expiresAt),
    };
  }
}
