/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ChangePasswordRequest } from '../../../../common/models/ChangePasswordRequest';
import type { ProfileResponseDto } from '../../../../common/models/ProfileResponseDto';
import type { UpdateProfileRequest } from '../../../../common/models/UpdateProfileRequest';
import type { UpdateUserSettingsRequest } from '../../../../common/models/UpdateUserSettingsRequest';
import type { UserSessionResponseDto } from '../../../../common/models/UserSessionResponseDto';
import type { UserSettingsResponseDto } from '../../../../common/models/UserSettingsResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProfileApi {
    /**
     * Get the current user’s preferences
     * Answers with the defaults when the user has never saved any.
     * @returns UserSettingsResponseDto
     * @throws ApiError
     */
    public static getSettings(): CancelablePromise<UserSettingsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/profile/settings',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Replace the current user’s preferences
     * Every preference is required — this is a replace, not a patch.
     * @param requestBody
     * @returns UserSettingsResponseDto
     * @throws ApiError
     */
    public static updateSettings(
        requestBody: UpdateUserSettingsRequest,
    ): CancelablePromise<UserSettingsResponseDto> {
        return __request(OpenAPI, {
            method: 'PUT',
            url: '/api/v1/profile/settings',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Upload the current user’s avatar
     * @param formData
     * @returns ProfileResponseDto
     * @throws ApiError
     */
    public static uploadAvatar(
        formData: {
            file: Blob;
        },
    ): CancelablePromise<ProfileResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/profile/avatar',
            formData: formData,
            mediaType: 'multipart/form-data',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `PROFILE_001 — Profile not found`,
                413: `PROFILE_005 — Image too large`,
                415: `PROFILE_004 — Unsupported image type`,
            },
        });
    }
    /**
     * Remove the current user’s avatar
     * @returns ProfileResponseDto
     * @throws ApiError
     */
    public static deleteAvatar(): CancelablePromise<ProfileResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/profile/avatar',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `PROFILE_001 — Profile not found`,
            },
        });
    }
    /**
     * List the current user’s active sessions
     * Devices signed in to this account. Internal sessions minted for API tokens and OAuth clients are not devices and are not listed — revoke those where they are managed. Session tokens are never returned — revoke by session id instead.
     * @returns UserSessionResponseDto
     * @throws ApiError
     */
    public static findSessions(): CancelablePromise<Array<UserSessionResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/profile/sessions',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Sign out every other session
     * Session-authenticated only. The session making the request survives.
     * @returns void
     * @throws ApiError
     */
    public static revokeOtherSessions(): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/profile/sessions',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Revoke one of the current user’s sessions
     * Session-authenticated only. The session in use cannot revoke itself.
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static revokeSession(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/profile/sessions/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `PROFILE_003 — Session not found`,
                409: `PROFILE_007 — The session in use cannot be revoked`,
            },
        });
    }
    /**
     * Change the current user’s password
     * Session-authenticated only — not reachable with an API token or OAuth credential.
     * @param requestBody
     * @returns void
     * @throws ApiError
     */
    public static changePassword(
        requestBody: ChangePasswordRequest,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/profile/password',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                400: `PROFILE_006 — The new password does not meet the password policy
                PROFILE_002 — The current password is incorrect`,
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
            },
        });
    }
    /**
     * Get the current user’s profile
     * @returns ProfileResponseDto
     * @throws ApiError
     */
    public static getProfile(): CancelablePromise<ProfileResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/profile',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `PROFILE_001 — Profile not found`,
            },
        });
    }
    /**
     * Update the current user’s profile
     * @param requestBody
     * @returns ProfileResponseDto
     * @throws ApiError
     */
    public static updateProfile(
        requestBody: UpdateProfileRequest,
    ): CancelablePromise<ProfileResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/profile',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `PROFILE_001 — Profile not found`,
            },
        });
    }
}
