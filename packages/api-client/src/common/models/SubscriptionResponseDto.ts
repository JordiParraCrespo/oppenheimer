/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SubscriptionResponseDto = {
    id: string;
    status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused';
    priceId: string | null;
    /**
     * Human-readable plan name.
     */
    plan: string | null;
    /**
     * Recurring amount in the currency's minor unit (e.g. cents).
     */
    unitAmount: number | null;
    currency: string | null;
    interval: 'day' | 'week' | 'month' | 'year' | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
    createdAt: string;
    updatedAt: string;
};

