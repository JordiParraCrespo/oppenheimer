/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvitationResponseDto } from '../../../../common/models/InvitationResponseDto';
import type { InviteMemberRequest } from '../../../../common/models/InviteMemberRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizationInvitationsApi {
    /**
     * Invite a member to an organization
     * @param orgId
     * @param requestBody
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static invite(
        orgId: string,
        requestBody: InviteMemberRequest,
    ): CancelablePromise<InvitationResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations/{orgId}/invitations',
            path: {
                'orgId': orgId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * List pending invitations for an organization
     * @param orgId
     * @returns InvitationResponseDto
     * @throws ApiError
     */
    public static list(
        orgId: string,
    ): CancelablePromise<Array<InvitationResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations/{orgId}/invitations',
            path: {
                'orgId': orgId,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_009 / ORG_004 / ORG_011 — The invitation was issued to another account, the caller may not manage invitations, or their email is unverified
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 — The organization does not exist, or is not visible to the caller`,
                409: `ORG_010 / ORG_006 / ORG_014 — That user is already invited or already a member, or an invitation limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
}
