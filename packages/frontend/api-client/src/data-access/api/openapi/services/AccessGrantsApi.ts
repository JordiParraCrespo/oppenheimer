/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AccessGrantResponseDto } from '../../../../common/models/AccessGrantResponseDto';
import type { CreateAccessGrantRequest } from '../../../../common/models/CreateAccessGrantRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AccessGrantsApi {
    /**
     * List the access grants in the active organization
     * @returns AccessGrantResponseDto
     * @throws ApiError
     */
    public static list(): CancelablePromise<Array<AccessGrantResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/access-grants',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Grant access to specific records
     * The grant may not exceed the granter’s own access. Omitting resourceId grants every resource of that type, which requires already holding all of them.
     * @param requestBody
     * @returns AccessGrantResponseDto
     * @throws ApiError
     */
    public static create(
        requestBody: CreateAccessGrantRequest,
    ): CancelablePromise<AccessGrantResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/access-grants',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `GRANT_003 — The named principal does not belong to this organization`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `GRANT_002 — An access grant cannot exceed the granter's own access`,
            },
        });
    }
    /**
     * Revoke an access grant
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static revoke(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/access-grants/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `GRANT_001 — Access grant not found`,
            },
        });
    }
}
