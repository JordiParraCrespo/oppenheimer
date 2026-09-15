/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UserSessionResponseDto = {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    /**
     * True for the session this request was made with.
     */
    current: boolean;
    createdAt: string;
    /**
     * Last time the session was seen.
     */
    updatedAt: string;
    expiresAt: string;
};

