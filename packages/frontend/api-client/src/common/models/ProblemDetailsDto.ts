/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InvalidParamDto } from './InvalidParamDto';
export type ProblemDetailsDto = {
    /**
     * URI reference identifying the problem type. `about:blank` when the status code says everything.
     */
    type: string;
    /**
     * Short summary, stable per problem type
     */
    title: string;
    /**
     * HTTP status code
     */
    status: number;
    /**
     * Explanation specific to this occurrence
     */
    detail?: string;
    /**
     * URI reference of the specific occurrence — the request path
     */
    instance?: string;
    /**
     * Machine-readable catalog code
     */
    code?: string;
    /**
     * Correlation id of the request, for log lookups
     */
    correlationId?: string;
    /**
     * When it happened
     */
    timestamp?: string;
    /**
     * Per-field validation failures
     */
    invalidParams?: Array<InvalidParamDto>;
};

