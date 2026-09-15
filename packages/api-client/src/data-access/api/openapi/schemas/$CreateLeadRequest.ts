/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateLeadRequest = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 200,
            minLength: 1,
        },
        email: {
            type: 'string',
            isNullable: true,
            format: 'email',
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
        value: {
            type: 'number',
        },
        notes: {
            type: 'string',
            isNullable: true,
            maxLength: 5000,
        },
    },
} as const;
