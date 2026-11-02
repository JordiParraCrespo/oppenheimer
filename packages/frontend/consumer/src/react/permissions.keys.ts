'use client';

/** Query key factory for the permission catalog. */
export const permissionsKeys = {
  all: ['permissions'] as const,
  catalog: () => [...permissionsKeys.all, 'catalog'] as const,
};
