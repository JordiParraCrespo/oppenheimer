'use client';

export const sentryKeys = {
  all: ['sentry'] as const,
  status: () => [...sentryKeys.all, 'status'] as const,
};
