/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type AdminUserResponseDto = {
    id: string;
    email: string;
    name: string;
    /**
     * Global role name(s).
     */
    role: string | null;
    emailVerified: boolean;
    banned: boolean;
    banReason: string | null;
    banExpires: string | null;
    createdAt: string;
};

