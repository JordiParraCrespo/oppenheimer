'use client';

export const slackKeys = {
  all: ['slack'] as const,
  accounts: () => [...slackKeys.all, 'accounts'] as const,
  setup: (botId: string) => [...slackKeys.all, 'setup', botId] as const,
};
