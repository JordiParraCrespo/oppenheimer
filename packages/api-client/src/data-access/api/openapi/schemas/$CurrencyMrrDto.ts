/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CurrencyMrrDto = {
    properties: {
        currency: {
            type: 'string',
            isRequired: true,
        },
        mrr: {
            type: 'number',
            description: `MRR for this currency in its minor unit (e.g. cents).`,
            isRequired: true,
        },
    },
} as const;
