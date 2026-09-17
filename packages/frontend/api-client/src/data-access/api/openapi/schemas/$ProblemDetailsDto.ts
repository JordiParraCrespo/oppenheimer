/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export const $ProblemDetailsDto = {
    properties: {
        type: {
            type: 'string',
            description: `URI reference identifying the problem type. \`about:blank\` when the status code says everything.`,
            isRequired: true,
        },
        title: {
            type: 'string',
            description: `Short summary, stable per problem type`,
            isRequired: true,
        },
        status: {
            type: 'number',
            description: `HTTP status code`,
            isRequired: true,
        },
        detail: {
            type: 'string',
            description: `Explanation specific to this occurrence`,
        },
        instance: {
            type: 'string',
            description: `URI reference of the specific occurrence — the request path`,
        },
        code: {
            type: 'string',
            description: `Machine-readable catalog code`,
        },
        correlationId: {
            type: 'string',
            description: `Correlation id of the request, for log lookups`,
        },
        timestamp: {
            type: 'string',
            description: `When it happened`,
        },
        invalidParams: {
            type: 'array',
            contains: {
                type: 'InvalidParamDto',
            },
        },
    },
} as const;
