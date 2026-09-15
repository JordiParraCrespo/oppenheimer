/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AuthzResourceDto = {
    properties: {
        subject: {
            type: 'string',
            isRequired: true,
        },
        label: {
            type: 'string',
            isRequired: true,
        },
        group: {
            type: 'string',
            isRequired: true,
        },
        actions: {
            type: 'array',
            contains: {
                type: 'ResourceActionDto',
            },
            isRequired: true,
        },
        fields: {
            type: 'array',
            contains: {
                type: 'string',
            },
        },
        scopes: {
            type: 'array',
            contains: {
                type: 'string',
            },
            isRequired: true,
        },
        credentialScope: {
            type: 'string',
            description: `Credential-scope group, when the resource is reachable by API tokens.`,
        },
    },
} as const;
