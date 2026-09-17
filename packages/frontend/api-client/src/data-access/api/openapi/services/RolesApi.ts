/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AssignUserRolesRequest } from '../../../../common/models/AssignUserRolesRequest';
import type { CreateRoleRequest } from '../../../../common/models/CreateRoleRequest';
import type { PaginatedRolesResponseDto } from '../../../../common/models/PaginatedRolesResponseDto';
import type { RoleResponseDto } from '../../../../common/models/RoleResponseDto';
import type { UpdateRolePermissionsRequest } from '../../../../common/models/UpdateRolePermissionsRequest';
import type { UpdateRoleRequest } from '../../../../common/models/UpdateRoleRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RolesApi {
    /**
     * List all roles
     * @param search Search by role name
     * @param limit Items per page (default: 20, max: 100)
     * @param page Page number (default: 1)
     * @returns PaginatedRolesResponseDto
     * @throws ApiError
     */
    public static findAll(
        search?: string,
        limit?: number,
        page?: number,
    ): CancelablePromise<PaginatedRolesResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/roles',
            query: {
                'search': search,
                'limit': limit,
                'page': page,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Create role
     * @param requestBody
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static create(
        requestBody: CreateRoleRequest,
    ): CancelablePromise<RoleResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/roles',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                409: `ROLE_002 — A role with this name already exists`,
            },
        });
    }
    /**
     * Get role by ID
     * @param id
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static findOne(
        id: string,
    ): CancelablePromise<RoleResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/roles/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ROLE_001 — Role not found`,
            },
        });
    }
    /**
     * Update a role (description and/or permissions)
     * @param id
     * @param requestBody
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static update(
        id: string,
        requestBody: UpdateRoleRequest,
    ): CancelablePromise<RoleResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/roles/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ROLE_001 — Role not found`,
            },
        });
    }
    /**
     * Delete role
     * @param id
     * @returns any
     * @throws ApiError
     */
    public static remove(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/roles/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ROLE_003 — System roles cannot be deleted`,
                404: `ROLE_001 — Role not found`,
            },
        });
    }
    /**
     * Replace a role's permission set
     * @param id
     * @param requestBody
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static updatePermissions(
        id: string,
        requestBody: UpdateRolePermissionsRequest,
    ): CancelablePromise<RoleResponseDto> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/roles/{id}/permissions',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ROLE_001 — Role not found`,
            },
        });
    }
    /**
     * List a user's assigned roles
     * @param userId
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static findUserRoles(
        userId: string,
    ): CancelablePromise<Array<RoleResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/users/{userId}/roles',
            path: {
                'userId': userId,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Replace a user's assigned roles
     * @param userId
     * @param requestBody
     * @returns RoleResponseDto
     * @throws ApiError
     */
    public static assign(
        userId: string,
        requestBody: AssignUserRolesRequest,
    ): CancelablePromise<Array<RoleResponseDto>> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/users/{userId}/roles',
            path: {
                'userId': userId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ROLE_005 — Assigning a role that grants more than the caller holds`,
                404: `USER_001 / ROLE_001 — User or role not found`,
            },
        });
    }
}
