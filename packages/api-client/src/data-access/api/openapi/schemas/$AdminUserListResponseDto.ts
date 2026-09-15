/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AdminUserListResponseDto = {
    properties: {
        users: {
            type: 'array',
            contains: {
                type: 'AdminUserResponseDto',
            },
            isRequired: true,
        },
        total: {
            type: 'number',
            isRequired: true,
        },
        limit: {
            type: 'number',
            isRequired: true,
            isNullable: true,
        },
        offset: {
            type: 'number',
            isRequired: true,
            isNullable: true,
        },
    },
} as const;
