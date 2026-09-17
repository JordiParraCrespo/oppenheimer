/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AdminCreateUserRequest = {
    properties: {
        email: {
            type: 'string',
            isRequired: true,
            format: 'email',
        },
        name: {
            type: 'string',
            isRequired: true,
            minLength: 1,
        },
        password: {
            type: 'string',
            minLength: 8,
        },
        role: {
            type: 'one-of',
            contains: [{
                type: 'string',
            }, {
                type: 'array',
                contains: {
                    type: 'string',
                },
            }],
        },
    },
} as const;
