/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ApiTokenResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        prefix: {
            type: 'string',
            description: `Non-secret display prefix. The secret itself is shown only once, at creation.`,
            isRequired: true,
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
            },
            isRequired: true,
            isNullable: true,
        },
        ipAllowlist: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
            isNullable: true,
        },
        expiresAt: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        lastUsedAt: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        revokedAt: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
