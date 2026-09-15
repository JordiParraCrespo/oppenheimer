/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AdminSessionResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        userId: {
            type: 'string',
            isRequired: true,
        },
        expiresAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        ipAddress: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        userAgent: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
