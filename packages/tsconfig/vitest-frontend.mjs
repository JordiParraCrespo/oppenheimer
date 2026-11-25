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
 * Both run on the `vmThreads` pool. A spec's time is mostly building a jsdom
 * and importing React and the design system, not its tests; the default pool
 * pays that per file, a VM context per file on a long-lived worker pays the
 * jsdom once per worker and still gives each file its own modules, document,
 * storage and globals, so `vi.mock` and a leftover tree stay inside the file.
 * Those contexts pile up in the worker until it is recycled, by default at the
 * machine's memory over its CPU count: `apps/web` reached 8.7GB, and on the CI
 * VM other packages' tests stalled for 20 to 70 seconds beside it (main-red
 * #1066). {@link VM_MEMORY_LIMIT} recycles a worker sooner.
 * Inside a VM context jsdom behaves more like a browser than it does under
 * `forks`: `window.location` cannot be redefined, and Node's globals that jsdom
 * does not implement (`ReadableStream`) are absent.
 *
 * It is shared rather than copied into each package because the failure mode is
 * silent: a package that sets up only the `unit` project still runs its budget
 * specs, with the compiler on, and they pass.
 */

/** Specs whose subject is what a component *costs*, not what it shows. */
const RENDER_BUDGET = 'src/**/*-render.spec.tsx';
const ALL_SPECS = ['src/**/*.spec.ts', 'src/**/*.spec.tsx'];
/** Per worker: `apps/web` peaks at 5.1GB with it, 8.7GB without, and runs no slower. */
const VM_MEMORY_LIMIT = '1GB';

/**
 * @param {object} options
 * @param {(config?: unknown) => unknown} options.react the package's `@vitejs/plugin-react`
 * @param {Record<string, string>} [options.alias] `resolve.alias`, for an app's `@/`
 * @returns {{ vmMemoryLimit: string, projects: unknown[] }} the `test` block for `defineConfig`
 */
export function frontendVitestProjects({ react, alias }) {
  const resolve = alias ? { alias } : undefined;

  return {
    // Read from the root only: set inside a project, vitest ignores it.
    vmMemoryLimit: VM_MEMORY_LIMIT,
    projects: [
      {
        plugins: [react({ compiler: true })],
        resolve,
        test: {
          name: 'unit',
          pool: 'vmThreads',
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
          pool: 'vmThreads',
          environment: 'jsdom',
          include: [RENDER_BUDGET],
        },
      },
    ],
  };
}
