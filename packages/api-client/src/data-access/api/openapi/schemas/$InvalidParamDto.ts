/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $InvalidParamDto = {
    properties: {
        name: {
            type: 'string',
            description: `Dotted path to the offending field`,
            isRequired: true,
        },
        reason: {
            type: 'string',
            description: `Why the value was rejected`,
            isRequired: true,
        },
    },
} as const;
