/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BillingSessionResponseDto } from '../../../../common/models/BillingSessionResponseDto';
import type { CreateCheckoutRequest } from '../../../../common/models/CreateCheckoutRequest';
import type { CreatePortalRequest } from '../../../../common/models/CreatePortalRequest';
import type { RevenueMetricsResponseDto } from '../../../../common/models/RevenueMetricsResponseDto';
import type { SubscriptionResponseDto } from '../../../../common/models/SubscriptionResponseDto';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class BillingApi {
    /**
     * Create a Stripe Checkout session for a subscription
     * @param requestBody
     * @returns BillingSessionResponseDto
     * @throws ApiError
     */
    public static checkout(
        requestBody: CreateCheckoutRequest,
    ): CancelablePromise<BillingSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/billing/checkout',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                409: `BILLING_006 — This user already has an active subscription`,
                503: `BILLING_001 — Billing is not configured`,
            },
        });
    }
    /**
     * Open a Stripe Customer Portal session
     * @param requestBody
     * @returns BillingSessionResponseDto
     * @throws ApiError
     */
    public static portal(
        requestBody: CreatePortalRequest,
    ): CancelablePromise<BillingSessionResponseDto> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/v1/billing/portal',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                404: `BILLING_002 — No billing customer exists for this user`,
            },
        });
    }
    /**
     * Get the current user's subscription (null if none)
     * @returns SubscriptionResponseDto
     * @throws ApiError
     */
    public static getSubscription(): CancelablePromise<SubscriptionResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/billing/subscription',
        });
    }
    /**
     * List all subscriptions (admin)
     * @param status Filter by status
     * @param limit Items per page (default: 20, max: 100)
     * @param page Page number (default: 1)
     * @returns any
     * @throws ApiError
     */
    public static findAll(
        status?: string,
        limit?: number,
        page?: number,
    ): CancelablePromise<any> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/billing/subscriptions',
            query: {
                'status': status,
                'limit': limit,
                'page': page,
            },
            errors: {
                403: `AUTH_002 — The caller's roles do not permit this`,
            },
        });
    }
    /**
     * Get aggregate revenue metrics (admin)
     * @returns RevenueMetricsResponseDto
     * @throws ApiError
     */
    public static metrics(): CancelablePromise<RevenueMetricsResponseDto> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/v1/billing/metrics',
            errors: {
                403: `AUTH_002 — The caller's roles do not permit this`,
            },
        });
    }
}
