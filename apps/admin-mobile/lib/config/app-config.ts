import type { VersionedConfig } from '@oppenheimer/frontend/config';

export type AppConfig = VersionedConfig & {
  featureFlags: {
    catalogNotice: boolean;
  };
  remote: {
    url?: string;
  };
};

export const staticConfig: AppConfig = {
  version: 1,
  featureFlags: {
    catalogNotice: false,
  },
  remote: {
    url: process.env.EXPO_PUBLIC_CONFIG_URL,
  },
};
