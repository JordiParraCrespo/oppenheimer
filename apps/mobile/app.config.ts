import { loadEnv } from '@oppenheimer/env';
import type { ExpoConfig } from 'expo/config';

// Expo only reads .env files from the app directory, but this monorepo keeps a
// single .env at the workspace root. This config runs in Node before Metro
// starts, so loading here puts EXPO_PUBLIC_* values into process.env in time
// for the bundler to inline them. Real environment variables still win.
loadEnv();

const plugins: ExpoConfig['plugins'] = [
  'expo-router',
  'expo-secure-store',
  'expo-localization',
  'expo-dev-client',
  'expo-image',
  [
    'react-native-nano-icons',
    {
      iconSets: [{ inputDir: '../../packages/design-system/mobile/assets/icons/ui' }],
    },
  ],
];

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  plugins.push([
    '@sentry/react-native/expo',
    {
      organization: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    },
  ]);
}

const config: ExpoConfig = {
  name: 'Oppenheimer',
  slug: 'oppenheimer',
  version: '0.1.0',
  // Deep-link scheme; the public variable is bundled into the client and must
  // agree with the API's MOBILE_SCHEME trusted origin.
  scheme: process.env.EXPO_PUBLIC_MOBILE_SCHEME ?? process.env.MOBILE_SCHEME ?? 'oppenheimer',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.oppenheimer.app',
    supportsTablet: true,
  },
  android: {
    package: 'com.oppenheimer.app',
    adaptiveIcon: {
      backgroundColor: '#ffffff',
    },
  },
  plugins,
};

export default config;
