/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CapabilitiesResponseDto } from '../../../../common/models/CapabilitiesResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class HealthApi {
    /**
     * Liveness check
     * @returns any App is alive
     *
     * The Health Check is successful
     * @throws ApiError
     */
    public static check(): CancelablePromise<{
        status?: string;
        info?: Record<string, Record<string, any>> | null;
        error?: Record<string, Record<string, any>> | null;
        details?: Record<string, Record<string, any>>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/health',
            errors: {
                503: `The Health Check is not successful`,
            },
        });
    }
    /**
     * Client-facing capabilities of this deployment
     * @returns CapabilitiesResponseDto Which client-relevant optional features (OAuth providers, Stripe billing) this deployment has configured. `false` means not configured, not unhealthy. Server-internal capabilities are not exposed here.
     * @throws ApiError
     */
    public static deploymentCapabilities(): CancelablePromise<CapabilitiesResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/health/capabilities',
        });
    }
    /**
     * Readiness check
     * @returns any App is ready to receive traffic
     *
     * The Health Check is successful
     * @throws ApiError
     */
    public static readiness(): CancelablePromise<{
        status?: string;
        info?: Record<string, Record<string, any>> | null;
        error?: Record<string, Record<string, any>> | null;
        details?: Record<string, Record<string, any>>;
    }> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/ready',
            errors: {
                503: `The Health Check is not successful`,
            },
        });
    }
}
