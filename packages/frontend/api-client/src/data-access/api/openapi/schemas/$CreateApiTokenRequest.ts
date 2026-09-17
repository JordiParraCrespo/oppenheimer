/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateApiTokenRequest = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 80,
            minLength: 1,
        },
        scopes: {
            type: 'array',
            contains: {
                type: 'Enum',
            },
            isRequired: true,
        },
        organizationIds: {
            type: 'array',
            contains: {
                type: 'string',
                format: 'uuid',
            },
        },
        expiresInDays: {
            type: 'number',
            isNullable: true,
            maximum: 3650,
            minimum: 1,
        },
        ipAllowlist: {
            type: 'array',
            contains: {
                type: 'string',
                maxLength: 49,
                minLength: 2,
            },
        },
    },
} as const;
