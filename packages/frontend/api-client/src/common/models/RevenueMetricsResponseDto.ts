/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CurrencyMrrDto } from './CurrencyMrrDto';
export type RevenueMetricsResponseDto = {
    /**
     * Currency of the headline mrr/arr — the currency with the highest MRR.
     */
    currency: string;
    /**
     * Headline Monthly Recurring Revenue in minor units (yearly plans normalized /12).
     */
    mrr: number;
    /**
     * Headline Annual Recurring Revenue in minor units (mrr * 12).
     */
    arr: number;
    /**
     * Per-currency MRR breakdown (never mixes currencies into one total).
     */
    mrrByCurrency: Array<CurrencyMrrDto>;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    pastDueSubscriptions: number;
    canceledSubscriptions: number;
    /**
     * Subscriptions canceled within the trailing 30 days.
     */
    canceledLast30Days: number;
    /**
     * Approximate monthly churn: canceledLast30Days / (active + canceledLast30Days), in [0, 1].
     */
    churnRate: number;
};

