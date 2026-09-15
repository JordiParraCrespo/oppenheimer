/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AuthzResourceGroupDto = {
    properties: {
        group: {
            type: 'string',
            isRequired: true,
        },
        resources: {
            type: 'array',
            contains: {
                type: 'AuthzResourceDto',
            },
            isRequired: true,
        },
    },
} as const;
