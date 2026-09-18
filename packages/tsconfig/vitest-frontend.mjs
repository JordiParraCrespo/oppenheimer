/**
 * The two vitest projects every frontend package runs, in one place.
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
 * @returns {{ projects: unknown[] }} the `test` block for `defineConfig`
 */
export function frontendVitestProjects({ react, alias }) {
  const resolve = alias ? { alias } : undefined;

  return {
    projects: [
      {
        plugins: [react({ compiler: true })],
        resolve,
        test: {
          name: 'unit',
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
          environment: 'jsdom',
          include: [RENDER_BUDGET],
        },
      },
    ],
  };
}
