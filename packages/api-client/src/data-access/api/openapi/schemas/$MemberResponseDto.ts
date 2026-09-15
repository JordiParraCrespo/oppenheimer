/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $MemberResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        organizationId: {
            type: 'string',
            isRequired: true,
        },
        userId: {
            type: 'string',
            isRequired: true,
        },
        role: {
            type: 'string',
            description: `Organization role (owner | admin | member | custom).`,
            isRequired: true,
        },
        createdAt: {
            type: 'string',
            isRequired: true,
            format: 'date-time',
        },
        user: {
            type: 'all-of',
            contains: [{
                type: 'MemberUserResponseDto',
            }],
            isRequired: true,
            isNullable: true,
        },
    },
} as const;
