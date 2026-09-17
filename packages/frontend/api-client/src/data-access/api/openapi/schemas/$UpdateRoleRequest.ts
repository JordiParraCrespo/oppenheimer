/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $UpdateRoleRequest = {
    properties: {
        description: {
            type: 'string',
            maxLength: 255,
        },
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
        },
    },
} as const;
