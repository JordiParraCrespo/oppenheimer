/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $OrganizationResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        slug: {
            type: 'string',
            isRequired: true,
        },
        logo: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        metadata: {
            type: 'dictionary',
            contains: {
                properties: {
                },
            },
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
