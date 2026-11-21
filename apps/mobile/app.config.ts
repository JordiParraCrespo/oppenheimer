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
  // ccache for the C, C++ and Objective-C in a native build (Swift is not
  // cached), used when `ccache` is on the PATH at `pod install`
  // (`brew install ccache`). It speeds up a rebuild of the same checkout after
  // `prebuild --clean`; a checkout whose native side matches an earlier build
  // skips the build altogether (build-cache.js).
  ['expo-build-properties', { ios: { ccacheEnabled: true } }],
  [
    'react-native-nano-icons',
    {
      iconSets: [{ inputDir: '../../packages/frontend/design-system/mobile/assets/icons/ui' }],
    },
  ],
  // oppenheimer:plugins expo-plugins
];

const config: ExpoConfig = {
  name: 'Oppenheimer',
  slug: 'oppenheimer',
  version: '0.1.0',
  // Deep-link scheme; the public variable is bundled into the client and must
  // agree with the API's MOBILE_SCHEME trusted origin.
  scheme: process.env.EXPO_PUBLIC_MOBILE_SCHEME ?? process.env.MOBILE_SCHEME ?? 'oppenheimer',
  platforms: ['ios', 'android'],
  userInterfaceStyle: 'automatic',
  // The React Compiler memoises components and hooks at build time, so the
  // screens never reach for `useMemo`, `useCallback` or `memo` by hand.
  // `babel-plugin-react-compiler` is the devDependency Expo's preset picks up.
  experiments: { reactCompiler: true },
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
  // Every session is a worktree of its own, so a native build reused nothing
  // from the one before. A build is kept per fingerprint on the machine and
  // installed again wherever the fingerprint matches (build-cache.js).
  buildCacheProvider: { plugin: './build-cache.js' },
};

export default config;
