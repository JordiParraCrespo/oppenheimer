/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $RevenueMetricsResponseDto = {
    properties: {
        currency: {
            type: 'string',
            description: `Currency of the headline mrr/arr — the currency with the highest MRR.`,
            isRequired: true,
        },
        mrr: {
            type: 'number',
            description: `Headline Monthly Recurring Revenue in minor units (yearly plans normalized /12).`,
            isRequired: true,
        },
        arr: {
            type: 'number',
            description: `Headline Annual Recurring Revenue in minor units (mrr * 12).`,
            isRequired: true,
        },
        mrrByCurrency: {
            type: 'array',
            contains: {
                type: 'CurrencyMrrDto',
            },
            isRequired: true,
        },
        activeSubscriptions: {
            type: 'number',
            isRequired: true,
        },
        trialingSubscriptions: {
            type: 'number',
            isRequired: true,
        },
        pastDueSubscriptions: {
            type: 'number',
            isRequired: true,
        },
        canceledSubscriptions: {
            type: 'number',
            isRequired: true,
        },
        canceledLast30Days: {
            type: 'number',
            description: `Subscriptions canceled within the trailing 30 days.`,
            isRequired: true,
        },
        churnRate: {
            type: 'number',
            description: `Approximate monthly churn: canceledLast30Days / (active + canceledLast30Days), in [0, 1].`,
            isRequired: true,
        },
    },
} as const;
