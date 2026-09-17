/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ResourceActionDto = {
    properties: {
        name: {
            type: 'string',
            isRequired: true,
        },
        label: {
            type: 'string',
        },
        sensitive: {
            type: 'boolean',
            description: `Flagged in the role builder. Not treated differently at request time.`,
        },
    },
} as const;
