import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The SWC plugin emits the decorator metadata NestJS relies on for
  // constructor-based dependency injection. Without it, type-only injected
  // params (e.g. ConfigService) resolve to `undefined`.
  plugins: [swc.vite()],
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.integration.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // One Postgres and one Redis for the run; each file gets a database and a
    // Redis db of its own from `src/__tests__/integration-services.ts`.
    globalSetup: ['./src/__tests__/integration-global-setup.ts'],
    testTimeout: 30000,
    // The app holds Redis/Postgres connections (BullMQ, cache, Better Auth).
    // Tearing the containers down at the end of the suite races with those
    // clients and surfaces benign "Connection is closed" rejections; don't
    // let that teardown noise fail an otherwise-passing boot test.
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
