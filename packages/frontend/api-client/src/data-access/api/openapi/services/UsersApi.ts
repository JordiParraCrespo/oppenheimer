/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MyPermissionsResponseDto } from '../../../../common/models/MyPermissionsResponseDto';
import type { PaginatedUsersResponseDto } from '../../../../common/models/PaginatedUsersResponseDto';
import type { UpdateUserRequest } from '../../../../common/models/UpdateUserRequest';
import type { UserResponseDto } from '../../../../common/models/UserResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UsersApi {
    /**
     * List all users (admin)
     * @param search Search by name or email
     * @param role Filter by role name
     * @param limit Items per page (default: 20, max: 100)
     * @param page Page number (default: 1)
     * @returns PaginatedUsersResponseDto
     * @throws ApiError
     */
    public static findAll(
        search?: string,
        role?: string,
        limit?: number,
        page?: number,
    ): CancelablePromise<PaginatedUsersResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/users',
            query: {
                'search': search,
                'role': role,
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
     * Get current user profile
     * @returns UserResponseDto
     * @throws ApiError
     */
    public static me(): CancelablePromise<UserResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/users/me',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Get the current user’s effective permissions
     * The union of every role assigned to the caller, as CASL rules. Drives which routes the web app shows in its sidebar.
     * @returns MyPermissionsResponseDto
     * @throws ApiError
     */
    public static permissions(): CancelablePromise<MyPermissionsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/users/me/permissions',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Get user by ID
     * @param id
     * @returns UserResponseDto
     * @throws ApiError
     */
    public static findOne(
        id: string,
    ): CancelablePromise<UserResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/users/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `USER_001 — User not found`,
            },
        });
    }
    /**
     * Update user
     * @param id
     * @param requestBody
     * @returns UserResponseDto
     * @throws ApiError
     */
    public static update(
        id: string,
        requestBody: UpdateUserRequest,
    ): CancelablePromise<UserResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/users/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `USER_001 — User not found`,
            },
        });
    }
    /**
     * Delete user
     * @param id
     * @returns any
     * @throws ApiError
     */
    public static remove(
        id: string,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/users/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `USER_001 — User not found`,
            },
        });
    }
}
