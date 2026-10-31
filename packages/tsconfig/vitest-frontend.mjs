/**
 * The two vitest projects of the packages with component specs (`apps/web`,
 * `packages/frontend/web`), in one place.
 *
 * They want opposite things from the React Compiler, and that is the whole
 * point of there being two:
 *
 * - `unit` runs it, so a test exercises what production ships.
 * - `render-budget` does not. The compiler memoises a badly-shaped component
 *   into a clean profile — a page threading a query down to a single consumer,
 *   a picker redrawing thirty-three toggles for one click, both read as zero
 *   wasted renders with it on — so a `*-render.spec.tsx` that ran with it
 *   enabled would be measuring the build step rather than the code.
 *
 * Both run on the `vmThreads` pool by default. A spec's time is mostly building
 * a jsdom and importing React and the design system, not its tests; the default
 * pool pays that per file, a VM context per file on a long-lived worker pays the
 * jsdom once per worker and still gives each file its own modules, document,
 * storage and globals, so `vi.mock` and a leftover tree stay inside the file.
 * Inside a VM context jsdom behaves more like a browser than it does under
 * `forks`: `window.location` cannot be redefined, and Node's globals that jsdom
 * does not implement (`ReadableStream`) are absent. A package whose specs lean on
 * either passes `pool: 'forks'`.
 *
 * It is shared rather than copied into each package because the failure mode is
 * silent: a package that sets up only the `unit` project still runs its budget
 * specs, with the compiler on, and they pass. See
 * `.agents/rules/frontend-architecture.md`.
 */

/** Specs whose subject is what a component *costs*, not what it shows. */
const RENDER_BUDGET = 'src/**/*-render.spec.tsx';
const ALL_SPECS = ['src/**/*.spec.ts', 'src/**/*.spec.tsx'];

/**
 * @param {object} options
 * @param {(config?: unknown) => unknown} options.react the package's `@vitejs/plugin-react`
 * @param {Record<string, string>} [options.alias] `resolve.alias`, for an app's `@/`
 * @param {'vmThreads' | 'forks'} [options.pool] the worker pool, `vmThreads` unless a spec needs `forks`
 * @returns {{ projects: unknown[] }} the `test` block for `defineConfig`
 */
export function frontendVitestProjects({ react, alias, pool = 'vmThreads' }) {
  const resolve = alias ? { alias } : undefined;

  return {
    projects: [
      {
        plugins: [react({ compiler: true })],
        resolve,
        test: {
          name: 'unit',
          pool,
          environment: 'jsdom',
          include: ALL_SPECS,
          exclude: [RENDER_BUDGET],
        },
      },
      {
        plugins: [react()],
        resolve,
        test: {
          name: 'render-budget',
          pool,
          environment: 'jsdom',
          include: [RENDER_BUDGET],
        },
      },
    ],
  };
}
