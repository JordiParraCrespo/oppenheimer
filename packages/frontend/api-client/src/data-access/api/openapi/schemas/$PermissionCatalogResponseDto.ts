/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PermissionCatalogResponseDto = {
    properties: {
        groups: {
            type: 'array',
            contains: {
                type: 'PermissionGroupDto',
            },
            isRequired: true,
        },
        grantable: {
            type: 'array',
            contains: {
                type: 'Enum',
            },
            isRequired: true,
        },
    },
} as const;
