/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateAccessGrantRequest = {
    properties: {
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
            isRequired: true,
            maxLength: 100,
            minLength: 1,
        },
        resourceId: {
            type: 'string',
            isNullable: true,
            format: 'uuid',
        },
        expiresAt: {
            type: 'string',
            isNullable: true,
            format: 'date-time',
        },
    },
} as const;
