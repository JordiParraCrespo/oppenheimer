/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AccessGrantResponseDto = {
    id: string;
    organizationId: string;
    principalType: 'user' | 'team' | 'role';
    principalId: string;
    /**
     * A registry subject.
     */
    resourceType: string;
    /**
     * Null grants every resource of that type within the organization.
     */
    resourceId?: string | null;
    grantedBy: string;
    expiresAt?: string | null;
    createdAt: string;
};

