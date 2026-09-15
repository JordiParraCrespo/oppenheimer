/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiTokenResponseDto } from '../../../../common/models/ApiTokenResponseDto';
import type { CreateApiTokenRequest } from '../../../../common/models/CreateApiTokenRequest';
import type { CreatedApiTokenResponseDto } from '../../../../common/models/CreatedApiTokenResponseDto';
import type { CurrentCredentialResponseDto } from '../../../../common/models/CurrentCredentialResponseDto';
import type { PermissionCatalogResponseDto } from '../../../../common/models/PermissionCatalogResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ApiTokensApi {
    /**
     * Describe the calling credential and its effective permissions
     * Returns the credential kind, its granted scopes and what those scopes actually amount to once the owner’s roles are applied. The MCP server filters its tool list by `effectiveScopes`.
     * @returns CurrentCredentialResponseDto
     * @throws ApiError
     */
    public static current(): CancelablePromise<CurrentCredentialResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/me/credential',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * List the caller’s API tokens
     * Secrets are never returned — only the display prefix and metadata.
     * @returns ApiTokenResponseDto
     * @throws ApiError
     */
    public static findAll(): CancelablePromise<Array<ApiTokenResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tokens',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Mint an API token
     * Creates a scoped API token for the caller. The secret is returned once and cannot be retrieved again. Scopes may not exceed what the caller is themselves permitted to do.
     * @param requestBody
     * @returns CreatedApiTokenResponseDto
     * @throws ApiError
     */
    public static create(
        requestBody: CreateApiTokenRequest,
    ): CancelablePromise<CreatedApiTokenResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/tokens',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `TOKEN_002 / TOKEN_008 — Requested scopes exceed the caller’s own permissions, or the caller is not a member of a requested organization`,
                409: `TOKEN_009 — Active token limit reached`,
            },
        });
    }
    /**
     * List the permission catalog and what the caller may grant
     * Drives the permission picker on the token-creation screen and the CLI’s --permissions validation.
     * @returns PermissionCatalogResponseDto
     * @throws ApiError
     */
    public static permissions(): CancelablePromise<PermissionCatalogResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/tokens/permissions',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Revoke an API token
     * Takes effect immediately. The record is kept so the audit trail survives; the secret stops working.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static revoke(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/tokens/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `TOKEN_001 — Token not found`,
            },
        });
    }
}
