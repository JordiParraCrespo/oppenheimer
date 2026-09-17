/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CurrentCredentialResponseDto = {
    properties: {
        kind: {
            type: 'Enum',
            isRequired: true,
        },
        userId: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isRequired: true,
        },
        grantedScopes: {
            type: 'array',
            contains: {
                type: 'Enum',
            },
            isRequired: true,
            isNullable: true,
        },
        effectiveScopes: {
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
        expiresAt: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
    },
} as const;
