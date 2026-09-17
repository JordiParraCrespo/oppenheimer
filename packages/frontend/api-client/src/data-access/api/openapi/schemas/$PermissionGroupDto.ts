/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $PermissionGroupDto = {
    properties: {
        resource: {
            type: 'Enum',
            isRequired: true,
        },
        label: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
        },
        sensitive: {
            type: 'boolean',
            description: `Grants account-takeover-adjacent powers. Consent and token screens call these out; enforcement treats them like any other group.`,
        },
        levels: {
            type: 'ScopeLevelsDto',
            isRequired: true,
        },
    },
} as const;
