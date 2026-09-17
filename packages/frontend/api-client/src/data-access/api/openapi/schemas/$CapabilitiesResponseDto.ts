/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $CapabilitiesResponseDto = {
    properties: {
        google_oauth: {
            type: 'boolean',
            description: `Sign-in with Google is configured.`,
            isRequired: true,
        },
        github_oauth: {
            type: 'boolean',
            description: `Sign-in with GitHub is configured.`,
            isRequired: true,
        },
        stripe_billing: {
            type: 'boolean',
            description: `Stripe billing is configured.`,
            isRequired: true,
        },
    },
} as const;
