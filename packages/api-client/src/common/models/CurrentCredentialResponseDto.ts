/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CurrentCredentialResponseDto = {
    /**
     * How the caller authenticated.
     */
    kind: 'session' | 'api-token' | 'oauth';
    userId: string;
    email: string;
    /**
     * Scopes the credential carries. Null for a browser session, which is not scope-restricted.
     */
    grantedScopes: Array<'profile:read' | 'profile:write' | 'users:read' | 'users:write' | 'admin:read' | 'admin:write' | 'roles:read' | 'roles:write' | 'organizations:read' | 'organizations:write' | 'members:read' | 'members:write' | 'invitations:read' | 'invitations:write' | 'workspaces:read' | 'workspaces:write' | 'tokens:read' | 'tokens:write' | 'billing:read' | 'billing:write' | 'leads:read' | 'leads:write'> | null;
    /**
     * What the credential can actually do: its scopes intersected with the owner’s current roles.
     */
    effectiveScopes: Array<'profile:read' | 'profile:write' | 'users:read' | 'users:write' | 'admin:read' | 'admin:write' | 'roles:read' | 'roles:write' | 'organizations:read' | 'organizations:write' | 'members:read' | 'members:write' | 'invitations:read' | 'invitations:write' | 'workspaces:read' | 'workspaces:write' | 'tokens:read' | 'tokens:write' | 'billing:read' | 'billing:write' | 'leads:read' | 'leads:write'>;
    /**
     * Organizations the credential is restricted to, or null when unrestricted.
     */
    organizationIds: Array<string> | null;
    expiresAt: string | null;
};

