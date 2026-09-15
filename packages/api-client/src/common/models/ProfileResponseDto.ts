/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type ProfileResponseDto = {
    id: string;
    /**
     * Read-only here — changing it is an admin operation.
     */
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    jobTitle: string | null;
    avatarUrl: string | null;
    role: string;
    emailVerified: boolean;
    /**
     * Always false: two-factor authentication is not enabled on this deployment. Present so a client can render the control without probing for the field.
     */
    twoFactorEnabled: boolean;
    createdAt: string;
    updatedAt: string;
};

