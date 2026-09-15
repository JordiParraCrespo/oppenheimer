/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateWorkspaceRequest = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
            maxLength: 100,
            minLength: 1,
        },
        organizationId: {
            type: 'string',
            format: 'uuid',
        },
    },
} as const;
