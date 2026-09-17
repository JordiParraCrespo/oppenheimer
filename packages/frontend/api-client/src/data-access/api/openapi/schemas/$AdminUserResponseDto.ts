/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AdminUserResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        role: {
            type: 'string',
            description: `Global role name(s).`,
            isRequired: true,
            isNullable: true,
        },
        emailVerified: {
            type: 'boolean',
            isRequired: true,
        },
        banned: {
            type: 'boolean',
            isRequired: true,
        },
        banReason: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        banExpires: {
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
