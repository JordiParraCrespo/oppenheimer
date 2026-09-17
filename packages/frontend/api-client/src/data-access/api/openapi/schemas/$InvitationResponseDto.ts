/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $InvitationResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        organizationId: {
            type: 'string',
            isRequired: true,
        },
        email: {
            type: 'string',
            isRequired: true,
        },
        role: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        status: {
            type: 'string',
            description: `pending | accepted | rejected | canceled.`,
            isRequired: true,
        },
        teamId: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        inviterId: {
            type: 'string',
            isRequired: true,
        },
        expiresAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
    },
} as const;
