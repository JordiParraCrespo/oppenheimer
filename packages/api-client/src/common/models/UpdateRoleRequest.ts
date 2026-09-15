/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateRoleRequest = {
    description?: string;
    permissions?: Array<{
        action: string;
        subject: string;
        conditions?: Record<string, any>;
        fields?: Array<string>;
        inverted?: boolean;
        reason?: string;
    }>;
};

