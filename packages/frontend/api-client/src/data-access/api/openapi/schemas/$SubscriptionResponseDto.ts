/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $SubscriptionResponseDto = {
    properties: {
        id: {
            type: 'string',
            isRequired: true,
        },
        status: {
            type: 'Enum',
            isRequired: true,
        },
        priceId: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        plan: {
            type: 'string',
            description: `Human-readable plan name.`,
            isRequired: true,
            isNullable: true,
        },
        unitAmount: {
            type: 'number',
            description: `Recurring amount in the currency's minor unit (e.g. cents).`,
            isRequired: true,
            isNullable: true,
        },
        currency: {
            type: 'string',
            isRequired: true,
            isNullable: true,
        },
        interval: {
            type: 'Enum',
            isRequired: true,
            isNullable: true,
        },
        currentPeriodEnd: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
        },
        cancelAtPeriodEnd: {
            type: 'boolean',
            isRequired: true,
        },
        canceledAt: {
            type: 'string',
            isRequired: true,
            isNullable: true,
            format: 'date-time',
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
