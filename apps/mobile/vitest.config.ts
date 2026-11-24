import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.spec.ts'],
    exclude: ['node_modules/**', '.expo/**'],
    server: {
      deps: {
        // Inlined so the native modules it imports (react-native, expo-*) are
        // the spec's doubles: the auth client is tested with the real plugin.
        inline: ['@better-auth/expo'],
      },
    },
  },
});
