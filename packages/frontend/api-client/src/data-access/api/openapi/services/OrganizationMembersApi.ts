/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddMemberRequest } from '../../../../common/models/AddMemberRequest';
import type { MemberResponseDto } from '../../../../common/models/MemberResponseDto';
import type { UpdateMemberRoleRequest } from '../../../../common/models/UpdateMemberRoleRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class OrganizationMembersApi {
    /**
     * Get the caller's membership in the active organization
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static active(): CancelablePromise<MemberResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations/{orgId}/members/me',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * List members of an organization
     * @param orgId
     * @param roleIds Role facet: keep members holding any of these assigned roles; repeat the parameter to select several
     * @param search Filter by member name, email, organization role or assigned role name
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static list(
        orgId: string,
        roleIds?: Array<string>,
        search?: string,
    ): CancelablePromise<Array<MemberResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/organizations/{orgId}/members',
            path: {
                'orgId': orgId,
            },
            query: {
                'roleIds': roleIds,
                'search': search,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Add an existing user as a member
     * @param orgId
     * @param requestBody
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static add(
        orgId: string,
        requestBody: AddMemberRequest,
    ): CancelablePromise<MemberResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations/{orgId}/members',
            path: {
                'orgId': orgId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Change a member's organization role
     * @param orgId
     * @param memberId
     * @param requestBody
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static updateRole(
        orgId: string,
        memberId: string,
        requestBody: UpdateMemberRoleRequest,
    ): CancelablePromise<MemberResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/organizations/{orgId}/members/{memberId}',
            path: {
                'orgId': orgId,
                'memberId': memberId,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Remove a member from an organization
     * @param orgId
     * @param memberIdOrEmail
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static remove(
        orgId: string,
        memberIdOrEmail: string,
    ): CancelablePromise<MemberResponseDto> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/organizations/{orgId}/members/{memberIdOrEmail}',
            path: {
                'orgId': orgId,
                'memberIdOrEmail': memberIdOrEmail,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Leave an organization
     * @param orgId
     * @returns MemberResponseDto
     * @throws ApiError
     */
    public static leave(
        orgId: string,
    ): CancelablePromise<MemberResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/organizations/{orgId}/leave',
            path: {
                'orgId': orgId,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing members
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_001 / ORG_005 — The organization or the member does not exist`,
                409: `ORG_006 / ORG_007 / ORG_014 — Already a member, the last owner cannot leave, or a membership limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
}
