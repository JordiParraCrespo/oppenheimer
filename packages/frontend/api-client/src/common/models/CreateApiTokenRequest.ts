/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateApiTokenRequest = {
    name: string;
    scopes: Array<'profile:read' | 'profile:write' | 'users:read' | 'users:write' | 'admin:read' | 'admin:write' | 'roles:read' | 'roles:write' | 'organizations:read' | 'organizations:write' | 'members:read' | 'members:write' | 'invitations:read' | 'invitations:write' | 'workspaces:read' | 'workspaces:write' | 'tokens:read' | 'tokens:write' | 'billing:read' | 'billing:write' | 'leads:read' | 'leads:write'>;
    organizationIds?: Array<string>;
    expiresInDays?: number | null;
    ipAllowlist?: Array<string>;
};

