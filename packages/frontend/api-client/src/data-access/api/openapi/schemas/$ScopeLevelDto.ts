/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ScopeLevelDto = {
    properties: {
        scope: {
            type: 'Enum',
            isRequired: true,
        },
        label: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
        },
        policies: {
            type: 'array',
            contains: {
                type: 'ScopePolicyDto',
            },
            isRequired: true,
        },
    },
} as const;
