/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $InviteMemberRequest = {
    properties: {
        email: {
            type: 'string',
            isRequired: true,
            format: 'email',
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
