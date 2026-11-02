import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The React bindings in `src/react/` need a DOM to render into. The rest of
    // the suite is environment-agnostic and runs unchanged under jsdom.
    environment: 'jsdom',
    // A VM context per file on a long-lived worker: the jsdom is built once per
    // worker rather than once per file, which was most of the suite's time, and
    // each file still gets its own modules and document.
    pool: 'vmThreads',
    // `tsc` emits the specs into `dist/` alongside the sources it builds.
    // Vitest 5 dropped `dist` from its default excludes, so without this every
    // spec runs twice — once from `src`, once from its own build output.
    exclude: [...defaultExclude, 'dist/**'],
  },
});
