/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserSessionResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
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
        current: {
            type: 'boolean',
            description: `True for the session this request was made with.`,
            isRequired: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updatedAt: {
            type: 'string',
            description: `Last time the session was seen.`,
            isRequired: true,
            format: 'date-time',
        },
        expiresAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
