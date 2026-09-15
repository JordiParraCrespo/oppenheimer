/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ChangePasswordRequest = {
    properties: {
        currentPassword: {
            type: 'string',
            isRequired: true,
            minLength: 1,
        },
        newPassword: {
            type: 'string',
            isRequired: true,
            minLength: 8,
        },
        revokeOtherSessions: {
            type: 'boolean',
        },
    },
} as const;
