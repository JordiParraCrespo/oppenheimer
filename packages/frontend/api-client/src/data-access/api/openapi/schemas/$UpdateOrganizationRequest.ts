/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UpdateOrganizationRequest = {
    properties: {
        name: {
            type: 'string',
            maxLength: 100,
            minLength: 1,
        },
        slug: {
            type: 'string',
            maxLength: 48,
            minLength: 2,
            pattern: '^[a-z0-9-]+$',
        },
        logo: {
            type: 'string',
            isNullable: true,
            format: 'uri',
        },
    },
} as const;
