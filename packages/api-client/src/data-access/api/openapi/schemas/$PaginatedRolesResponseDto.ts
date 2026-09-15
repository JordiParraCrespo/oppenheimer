/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PaginatedRolesResponseDto = {
    properties: {
        data: {
            type: 'array',
            contains: {
                type: 'RoleResponseDto',
            },
            isRequired: true,
        },
        meta: {
            type: 'RolePaginationMetaDto',
            isRequired: true,
        },
    },
} as const;
