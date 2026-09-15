/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CreateCheckoutRequest = {
    properties: {
        priceId: {
            type: 'string',
            isRequired: true,
            minLength: 1,
        },
        successUrl: {
            type: 'string',
            format: 'uri',
        },
        cancelUrl: {
            type: 'string',
            format: 'uri',
        },
    },
} as const;
