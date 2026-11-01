'use client';

export const mailKeys = {
  all: ['mail'] as const,
  connections: () => [...mailKeys.all, 'connections'] as const,
  scheduled: () => [...mailKeys.all, 'scheduled'] as const,
};
