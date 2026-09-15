/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ScopeLevelsDto } from './ScopeLevelsDto';
export type PermissionGroupDto = {
    resource: 'profile' | 'users' | 'admin' | 'roles' | 'organizations' | 'members' | 'invitations' | 'workspaces' | 'tokens' | 'billing' | 'leads';
    label: string;
    description: string;
    /**
     * Grants account-takeover-adjacent powers. Consent and token screens call these out; enforcement treats them like any other group.
     */
    sensitive?: boolean;
    levels: ScopeLevelsDto;
};

