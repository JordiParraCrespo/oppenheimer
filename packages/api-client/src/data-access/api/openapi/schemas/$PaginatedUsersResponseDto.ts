/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PaginatedUsersResponseDto = {
    properties: {
        data: {
            type: 'array',
            contains: {
                type: 'UserResponseDto',
            },
            isRequired: true,
        },
        meta: {
            type: 'PaginationMetaDto',
            isRequired: true,
        },
    },
} as const;
