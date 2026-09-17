import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The React bindings in `src/react/` need a DOM to render into. The rest of
    // the suite is environment-agnostic and runs unchanged under jsdom.
    environment: 'jsdom',
    // `tsc` emits the specs into `dist/` alongside the sources it builds.
    // Vitest 5 dropped `dist` from its default excludes, so without this every
    // spec runs twice — once from `src`, once from its own build output.
    exclude: [...defaultExclude, 'dist/**'],
  },
});
