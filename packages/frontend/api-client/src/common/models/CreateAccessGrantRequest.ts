/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type CreateAccessGrantRequest = {
    principalType: 'user' | 'team' | 'role';
    principalId: string;
    resourceType: string;
    resourceId?: string | null;
    expiresAt?: string | null;
};

