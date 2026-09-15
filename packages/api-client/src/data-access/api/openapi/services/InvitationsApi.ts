/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvitationResponseDto } from '../../../../common/models/InvitationResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class InvitationsApi {
    /**
     * List the caller's pending invitations
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static listMine(): CancelablePromise<Array<InvitationResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/invitations',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_008 — The invitation does not exist or is no longer retrievable`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Get an invitation by id
     * @param id
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static get(
        id: string,
    ): CancelablePromise<InvitationResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/invitations/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_008 — The invitation does not exist or is no longer retrievable`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Accept an invitation
     * @param id
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static accept(
        id: string,
    ): CancelablePromise<InvitationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/invitations/{id}/accept',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_008 — The invitation does not exist or is no longer retrievable`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Reject an invitation
     * @param id
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static reject(
        id: string,
    ): CancelablePromise<InvitationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/invitations/{id}/reject',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_008 — The invitation does not exist or is no longer retrievable`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Cancel an invitation (organization manager)
     * @param id
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static cancel(
        id: string,
    ): CancelablePromise<InvitationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/invitations/{id}/cancel',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_008 — The invitation does not exist or is no longer retrievable`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
}
