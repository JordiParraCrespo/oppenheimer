/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $BanUserRequest = {
    properties: {
        banReason: {
            type: 'string',
            maxLength: 500,
        },
        banExpiresIn: {
            type: 'number',
            exclusiveMinimum: true,
        },
    },
} as const;
