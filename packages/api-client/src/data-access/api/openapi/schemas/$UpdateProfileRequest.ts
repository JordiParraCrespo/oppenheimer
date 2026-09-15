/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UpdateProfileRequest = {
    properties: {
        firstName: {
            type: 'string',
            maxLength: 100,
            minLength: 1,
        },
        lastName: {
            type: 'string',
            maxLength: 100,
            minLength: 1,
        },
        phone: {
            type: 'string',
            isNullable: true,
            maxLength: 32,
            minLength: 1,
        },
        jobTitle: {
            type: 'string',
            isNullable: true,
            maxLength: 120,
            minLength: 1,
        },
    },
} as const;
