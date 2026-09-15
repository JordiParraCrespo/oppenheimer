/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddWorkspaceMemberRequest } from '../../../../common/models/AddWorkspaceMemberRequest';
import type { CreateWorkspaceRequest } from '../../../../common/models/CreateWorkspaceRequest';
import type { UpdateWorkspaceRequest } from '../../../../common/models/UpdateWorkspaceRequest';
import type { WorkspaceMemberResponseDto } from '../../../../common/models/WorkspaceMemberResponseDto';
import type { WorkspaceResponseDto } from '../../../../common/models/WorkspaceResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class WorkspacesApi {
    /**
     * List the caller's workspaces
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static listMine(): CancelablePromise<Array<WorkspaceResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/workspaces/mine',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * List an organization's workspaces (defaults to the active org)
     * @param organizationId
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static list(
        organizationId?: string,
    ): CancelablePromise<Array<WorkspaceResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/workspaces',
            query: {
                'organizationId': organizationId,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Create a workspace
     * @param requestBody
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static create(
        requestBody: CreateWorkspaceRequest,
    ): CancelablePromise<WorkspaceResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/workspaces',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Rename a workspace
     * @param id
     * @param requestBody
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static update(
        id: string,
        requestBody: UpdateWorkspaceRequest,
    ): CancelablePromise<WorkspaceResponseDto> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/v1/workspaces/{id}',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Delete a workspace
     * @param id
     * @returns void
     * @throws ApiError
     */
    public static remove(
        id: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/workspaces/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Set the active workspace for the current session
     * @param id
     * @returns WorkspaceResponseDto
     * @throws ApiError
     */
    public static setActive(
        id: string,
    ): CancelablePromise<WorkspaceResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/workspaces/{id}/set-active',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * List members of a workspace
     * @param id
     * @returns WorkspaceMemberResponseDto
     * @throws ApiError
     */
    public static listMembers(
        id: string,
    ): CancelablePromise<Array<WorkspaceMemberResponseDto>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/workspaces/{id}/members',
            path: {
                'id': id,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Add a user to a workspace
     * @param id
     * @param requestBody
     * @returns WorkspaceMemberResponseDto
     * @throws ApiError
     */
    public static addMember(
        id: string,
        requestBody: AddWorkspaceMemberRequest,
    ): CancelablePromise<WorkspaceMemberResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/workspaces/{id}/members',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
    /**
     * Remove a user from a workspace
     * @param id
     * @param userId
     * @returns void
     * @throws ApiError
     */
    public static removeMember(
        id: string,
        userId: string,
    ): CancelablePromise<void> {
        return __request(OpenAPI, {
            method: 'DELETE',
            url: '/api/v1/workspaces/{id}/members/{userId}',
            path: {
                'id': id,
                'userId': userId,
            },
            errors: {
                401: `AUTH_001 / TOKEN_003 — No credential was presented, or it is invalid or expired`,
                403: `ORG_003 / ORG_004 — The caller is not a member, or their org role does not allow managing workspaces
                AUTH_002 / TOKEN_004 / TOKEN_005 / TOKEN_006 / TOKEN_007 — The caller's roles, or their credential's scopes, do not permit this`,
                404: `ORG_012 / ORG_001 / ORG_005 — The workspace, its organization, or the member does not exist`,
                409: `ORG_013 / ORG_014 — A workspace with that name exists, or a workspace limit was reached`,
                502: `ORG_016 — The organization service failed to handle the request`,
            },
        });
    }
}
