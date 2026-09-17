import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Oppenheimer Showcase',
  slug: 'oppenheimer-showcase',
  version: '0.1.0',
  scheme: 'oppenheimer-showcase',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.oppenheimer.showcase',
    supportsTablet: true,
  },
  android: {
    package: 'com.oppenheimer.showcase',
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-image',
    [
      'react-native-nano-icons',
      {
        iconSets: [{ inputDir: '../../packages/frontend/design-system/mobile/assets/icons/ui' }],
      },
    ],
  ],
};

export default config;
