/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $AddMemberRequest = {
    properties: {
        userId: {
            type: 'string',
            isRequired: true,
            format: 'uuid',
        },
        role: {
            type: 'Enum',
        },
        teamId: {
            type: 'string',
            format: 'uuid',
        },
    },
} as const;
