/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isRequired: true,
        },
        firstName: {
            type: 'string',
            isRequired: true,
        },
        lastName: {
            type: 'string',
            isRequired: true,
        },
        role: {
            type: 'string',
            isRequired: true,
        },
        isActive: {
            type: 'boolean',
            isRequired: true,
        },
        emailVerified: {
            type: 'boolean',
            isRequired: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updatedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
