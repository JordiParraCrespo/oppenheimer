/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { PermissionGroupDto } from './PermissionGroupDto';
export type PermissionCatalogResponseDto = {
    /**
     * Every permission group, each with a Read and an Edit level. Render these as the permission picker.
     */
    groups: Array<PermissionGroupDto>;
    /**
     * Scopes the caller may put on a token. Anything outside this list is refused at creation.
     */
    grantable: Array<'profile:read' | 'profile:write' | 'users:read' | 'users:write' | 'admin:read' | 'admin:write' | 'roles:read' | 'roles:write' | 'organizations:read' | 'organizations:write' | 'members:read' | 'members:write' | 'invitations:read' | 'invitations:write' | 'workspaces:read' | 'workspaces:write' | 'tokens:read' | 'tokens:write' | 'billing:read' | 'billing:write' | 'leads:read' | 'leads:write'>;
};

