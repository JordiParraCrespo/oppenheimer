/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RoleResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        description: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        isSystem: {
            type: 'boolean',
            description: `System roles cannot be deleted or renamed.`,
            isRequired: true,
        },
        organizationId: {
            type: 'string',
            description: `Owning organization, or null for a global role template shared by every tenant.`,
            isNullable: true,
        },
        permissions: {
            type: 'array',
            contains: {
                type: 'dictionary',
                contains: {
                    properties: {
                    },
                },
            },
            isRequired: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        updatedAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
