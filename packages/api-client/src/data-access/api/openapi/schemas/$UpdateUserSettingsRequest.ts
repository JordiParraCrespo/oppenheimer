/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UpdateUserSettingsRequest = {
    properties: {
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
    },
} as const;
