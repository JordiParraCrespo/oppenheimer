/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AccessGrantResponseDto = {
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
        principalType: {
            type: 'Enum',
            isRequired: true,
        },
        principalId: {
            type: 'string',
            isRequired: true,
            format: 'uuid',
        },
        resourceType: {
            type: 'string',
            description: `A registry subject.`,
            isRequired: true,
        },
        resourceId: {
            type: 'string',
            description: `Null grants every resource of that type within the organization.`,
            isNullable: true,
            format: 'uuid',
        },
        grantedBy: {
            type: 'string',
            isRequired: true,
            format: 'uuid',
        },
        expiresAt: {
            type: 'string',
            isNullable: true,
            format: 'date-time',
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
