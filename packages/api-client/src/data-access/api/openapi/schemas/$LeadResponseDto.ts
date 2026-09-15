/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $LeadResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
            format: 'uuid',
        },
        organizationId: {
            type: 'string',
            isRequired: true,
            format: 'uuid',
        },
        teamId: {
            type: 'string',
            isNullable: true,
            format: 'uuid',
        },
        ownerId: {
            type: 'string',
            isNullable: true,
            format: 'uuid',
        },
        name: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isNullable: true,
        },
        value: {
            type: 'number',
            description: `Deal value in minor units.`,
            isRequired: true,
        },
        notes: {
            type: 'string',
            isNullable: true,
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
