/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScopePolicyDto } from './ScopePolicyDto';
export type ScopeLevelDto = {
    scope: 'profile:read' | 'profile:write' | 'users:read' | 'users:write' | 'admin:read' | 'admin:write' | 'roles:read' | 'roles:write' | 'organizations:read' | 'organizations:write' | 'members:read' | 'members:write' | 'invitations:read' | 'invitations:write' | 'workspaces:read' | 'workspaces:write' | 'tokens:read' | 'tokens:write' | 'billing:read' | 'billing:write' | 'leads:read' | 'leads:write';
    label: string;
    description: string;
    /**
     * Empty when the level governs the caller’s own account only.
     */
    policies: Array<ScopePolicyDto>;
};

