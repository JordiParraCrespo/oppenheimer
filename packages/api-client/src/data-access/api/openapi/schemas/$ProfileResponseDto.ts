/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ProfileResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            description: `Read-only here — changing it is an admin operation.`,
            isRequired: true,
        },
        firstName: {
            type: 'string',
            isRequired: true,
        },
        lastName: {
            type: 'string',
            isRequired: true,
        },
        phone: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        jobTitle: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        avatarUrl: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        role: {
            type: 'string',
            isRequired: true,
        },
        emailVerified: {
            type: 'boolean',
            isRequired: true,
        },
        twoFactorEnabled: {
            type: 'boolean',
            description: `Always false: two-factor authentication is not enabled on this deployment. Present so a client can render the control without probing for the field.`,
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
