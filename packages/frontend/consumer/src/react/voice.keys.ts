'use client';

export const voiceKeys = {
  all: ['voice'] as const,
  status: () => [...voiceKeys.all, 'status'] as const,
};
