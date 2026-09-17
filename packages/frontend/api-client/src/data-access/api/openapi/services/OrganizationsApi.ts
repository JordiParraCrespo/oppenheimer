/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CheckSlugRequest } from '../../../../common/models/CheckSlugRequest';
import type { CreateOrganizationRequest } from '../../../../common/models/CreateOrganizationRequest';
import type { FullOrganizationResponseDto } from '../../../../common/models/FullOrganizationResponseDto';
import type { OrganizationResponseDto } from '../../../../common/models/OrganizationResponseDto';
import type { SlugAvailabilityResponseDto } from '../../../../common/models/SlugAvailabilityResponseDto';
import type { UpdateOrganizationRequest } from '../../../../common/models/UpdateOrganizationRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizationsApi {
    /**
     * Create an organization
     * @param requestBody
     * @returns OrganizationResponseDto
     * @throws ApiError
     */
    public static create(
        requestBody: CreateOrganizationRequest,
    ): CancelablePromise<OrganizationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * List the caller's organizations
     * @returns OrganizationResponseDto
     * @throws ApiError
     */
    public static list(): CancelablePromise<Array<OrganizationResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Check whether an organization slug is available
     * @param requestBody
     * @returns SlugAvailabilityResponseDto
     * @throws ApiError
     */
    public static checkSlug(
        requestBody: CheckSlugRequest,
    ): CancelablePromise<SlugAvailabilityResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations/check-slug',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Get an organization with its members, invitations and workspaces
     * @param id
     * @returns FullOrganizationResponseDto
     * @throws ApiError
     */
    public static getFull(
        id: string,
    ): CancelablePromise<FullOrganizationResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Update an organization
     * @param id
     * @param requestBody
     * @returns OrganizationResponseDto
     * @throws ApiError
     */
    public static update(
        id: string,
        requestBody: UpdateOrganizationRequest,
    ): CancelablePromise<OrganizationResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/organizations/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Delete an organization
     * @param id
     * @returns OrganizationResponseDto
     * @throws ApiError
     */
    public static remove(
        id: string,
    ): CancelablePromise<OrganizationResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/organizations/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Set the active organization for the current session
     * @param id
     * @returns OrganizationResponseDto
     * @throws ApiError
     */
    public static setActive(
        id: string,
    ): CancelablePromise<OrganizationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations/{id}/set-active',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member of the organization, or their org role does not allow this
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_002 / ORG_014 — The slug is taken, or an organization limit has been reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
}
