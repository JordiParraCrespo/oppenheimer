/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MemberUserResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isRequired: true,
        },
        image: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        firstName: {
            type: 'string',
            isRequired: true,
        },
        lastName: {
            type: 'string',
            isRequired: true,
        },
        isActive: {
            type: 'boolean',
            isRequired: true,
        },
        emailVerified: {
            type: 'boolean',
            isRequired: true,
        },
    },
} as const;
