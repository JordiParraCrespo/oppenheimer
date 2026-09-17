/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SetUserRoleRequest = {
    properties: {
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
            isRequired: true,
        },
    },
} as const;
