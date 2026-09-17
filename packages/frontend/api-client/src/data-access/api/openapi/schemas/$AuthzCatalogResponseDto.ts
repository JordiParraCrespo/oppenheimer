/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AuthzCatalogResponseDto = {
    properties: {
        groups: {
            type: 'array',
            contains: {
                type: 'AuthzResourceGroupDto',
            },
            isRequired: true,
        },
        grantable: {
            type: 'array',
            contains: {
                type: 'AuthzRuleDto',
            },
            isRequired: true,
        },
    },
} as const;
