/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AdminUpdateUserRequest = {
    properties: {
        name: {
            type: 'string',
            minLength: 1,
        },
        firstName: {
            type: 'string',
            minLength: 1,
        },
        lastName: {
            type: 'string',
            minLength: 1,
        },
        image: {
            type: 'string',
            format: 'uri',
        },
    },
} as const;
