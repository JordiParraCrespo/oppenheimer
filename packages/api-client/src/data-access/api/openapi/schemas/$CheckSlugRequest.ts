/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CheckSlugRequest = {
    properties: {
        slug: {
            type: 'string',
            isRequired: true,
            maxLength: 48,
            minLength: 2,
            pattern: '^[a-z0-9-]+$',
        },
    },
} as const;
