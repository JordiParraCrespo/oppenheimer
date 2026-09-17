/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UpdateRolePermissionsRequest = {
    properties: {
        permissions: {
            type: 'array',
            contains: {
                properties: {
                    action: {
                        type: 'string',
                        isRequired: true,
                        minLength: 1,
                    },
                    subject: {
                        type: 'string',
                        isRequired: true,
                        minLength: 1,
                    },
                    conditions: {
                        type: 'dictionary',
                        contains: {
                            properties: {
                            },
                        },
                    },
                    fields: {
                        type: 'array',
                        contains: {
                            type: 'string',
                            minLength: 1,
                        },
                    },
                    inverted: {
                        type: 'boolean',
                    },
                    reason: {
                        type: 'string',
                    },
                },
            },
            isRequired: true,
        },
    },
} as const;
