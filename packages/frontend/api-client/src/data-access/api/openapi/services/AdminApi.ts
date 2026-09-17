/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AdminCreateUserRequest } from '../../../../common/models/AdminCreateUserRequest';
import type { AdminSessionResponseDto } from '../../../../common/models/AdminSessionResponseDto';
import type { AdminSuccessResponseDto } from '../../../../common/models/AdminSuccessResponseDto';
import type { AdminUpdateUserRequest } from '../../../../common/models/AdminUpdateUserRequest';
import type { AdminUserListResponseDto } from '../../../../common/models/AdminUserListResponseDto';
import type { AdminUserResponseDto } from '../../../../common/models/AdminUserResponseDto';
import type { BanUserRequest } from '../../../../common/models/BanUserRequest';
import type { RevokeSessionRequest } from '../../../../common/models/RevokeSessionRequest';
import type { SetUserPasswordRequest } from '../../../../common/models/SetUserPasswordRequest';
import type { SetUserRoleRequest } from '../../../../common/models/SetUserRoleRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminApi {
    /**
     * List users
     * @param searchValue
     * @param searchField
     * @param limit
     * @param offset
     * @param sortBy
     * @param sortDirection
     * @returns AdminUserListResponseDto
     * @throws ApiError
     */
    public static listUsers(
        searchValue?: string,
        searchField?: 'email' | 'name',
        limit?: number,
        offset?: number,
        sortBy?: string,
        sortDirection?: 'asc' | 'desc',
    ): CancelablePromise<AdminUserListResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/users',
            query: {
                'searchValue': searchValue,
                'searchField': searchField,
                'limit': limit,
                'offset': offset,
                'sortBy': sortBy,
                'sortDirection': sortDirection,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Create a user
     * @param requestBody
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static createUser(
        requestBody: AdminCreateUserRequest,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Stop impersonating and restore the admin session
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static stopImpersonating(): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/stop-impersonating',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Revoke one of a user's sessions by id
     * @param id
     * @param requestBody
     * @returns AdminSuccessResponseDto
     * @throws ApiError
     */
    public static revokeSession(
        id: string,
        requestBody: RevokeSessionRequest,
    ): CancelablePromise<AdminSuccessResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/sessions/revoke',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_009 — Session not found`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Get a user
     * @param id
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static getUser(
        id: string,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/users/{id}',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Update a user's profile fields
     * @param id
     * @param requestBody
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static updateUser(
        id: string,
        requestBody: AdminUpdateUserRequest,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/admin/users/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Delete a user
     * @param id
     * @returns AdminSuccessResponseDto
     * @throws ApiError
     */
    public static removeUser(
        id: string,
    ): CancelablePromise<AdminSuccessResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/admin/users/{id}',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Set a user's global role
     * @param id
     * @param requestBody
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static setRole(
        id: string,
        requestBody: SetUserRoleRequest,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/role',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Ban a user
     * @param id
     * @param requestBody
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static ban(
        id: string,
        requestBody: BanUserRequest,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/ban',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Unban a user
     * @param id
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static unban(
        id: string,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/unban',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Impersonate a user (issues an impersonation session)
     * @param id
     * @returns AdminUserResponseDto
     * @throws ApiError
     */
    public static impersonate(
        id: string,
    ): CancelablePromise<AdminUserResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/impersonate',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * List a user's sessions
     * @param id
     * @returns AdminSessionResponseDto
     * @throws ApiError
     */
    public static listSessions(
        id: string,
    ): CancelablePromise<Array<AdminSessionResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/admin/users/{id}/sessions',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Revoke all of a user's sessions
     * @param id
     * @returns AdminSuccessResponseDto
     * @throws ApiError
     */
    public static revokeSessions(
        id: string,
    ): CancelablePromise<AdminSuccessResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/revoke-sessions',
            path: {
                'id': id,
            },
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
    /**
     * Set a user's password
     * @param id
     * @param requestBody
     * @returns AdminSuccessResponseDto
     * @throws ApiError
     */
    public static setPassword(
        id: string,
        requestBody: SetUserPasswordRequest,
    ): CancelablePromise<AdminSuccessResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/admin/users/{id}/set-password',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `ADMIN_005 / ADMIN_007 — The role is not assignable, or the request was otherwise rejected`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ADMIN_003 / ADMIN_004 / ADMIN_006 — The account may not perform this administrative action, it targets the caller themselves, or the target is banned
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ADMIN_001 — The user does not exist`,
                409: `ADMIN_002 — A user with that email already exists`,
                502: `ADMIN_008 — The admin service failed to handle the request`,
            },
        });
    }
}
