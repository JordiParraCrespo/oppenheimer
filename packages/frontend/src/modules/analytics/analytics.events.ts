/**
 * The event catalog.
 *
 * Analytics is only useful if event names are stable, so they live here rather
 * than as string literals at call sites: renaming an event in one place breaks
 * the build instead of silently splitting a funnel in two.
 *
 * Naming convention: `object_past_tense_verb`, lower snake case.
 */
export const ANALYTICS_EVENTS = {
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_OUT: 'user_signed_out',
  PASSWORD_RESET_REQUESTED: 'password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'password_reset_completed',
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** How a user authenticated, attached to sign-in/sign-up events. */
export type AuthMethod = 'password' | 'google' | 'github';
