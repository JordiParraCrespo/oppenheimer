/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UserSettingsResponseDto = {
    properties: {
        userId: {
            type: 'string',
            isRequired: true,
        },
        theme: {
            type: 'Enum',
            isRequired: true,
        },
        locale: {
            type: 'Enum',
            isRequired: true,
        },
        density: {
            type: 'Enum',
            isRequired: true,
        },
        weeklyDigest: {
            type: 'boolean',
            isRequired: true,
        },
        productUpdates: {
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
