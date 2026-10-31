/**
 * What a changed file means for a CI run, by path alone. `affected.mjs` asks
 * Turborepo about every file a package owns; these are the files no package
 * owns, sorted into three kinds:
 *
 *   global     something every job relies on (the workflow, the lockfile,
 *              the Docker context, the CI scripts themselves): a full run
 *   lint-only  a repo check the lint job runs whatever the diff, or an eval's
 *              fixtures: changing one selects no package
 *   owned      a root script that only one package's step runs: changing it
 *              selects that package, as an edit inside it would
 *
 * A path in none of them is left to Turborepo, which ignores what it does not
 * attribute to a package.
 */

/**
 * Paths outside every package that can still break any of them. Turbo does
 * not attribute these to a package, so a change here means a full run.
 */
export const GLOBAL_PATHS = [
  /^\.github\//,
  /^docker\//,
  /^\.dockerignore$/,
  /^turbo\.json$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^\.npmrc$/,
  /^\.env\.example$/,
  /^biome\.json$/,
  /^biome-plugins\//,
  /^tsconfig\.base\.json$/,
  /^scripts\//,
  // oppenheimer:begin runner
  /^go\.work/,
  /^\.golangci\.yml$/,
  // oppenheimer:end runner
];

/**
 * Under `scripts/`, but read only by the lint job, which runs every time:
 * the repo checks and their tests, and the evals' cases. A change here runs
 * lint and selects nothing else.
 */
export const LINT_ONLY_PATHS = [
  /^scripts\/check-(api-structure|feature-flags)(\.test)?\.mjs$/,
  // oppenheimer:begin web
  /^scripts\/check-(frontend-structure|react-compiler|singletons)(\.test)?\.mjs$/,
  /^scripts\/(query-state-slots|skeleton-shape|skeleton-slab-debt)(\.test)?\.mjs$/,
  // oppenheimer:end web
  /^scripts\/evals\//,
];

/** Root scripts that one package's step runs, and that package. */
export const OWNED_PATHS = [
  // oppenheimer:begin web
  // `First-load budgets`, a step of the web app's.
  [/^scripts\/check-bundle-size\.mjs$/, '@oppenheimer/web'],
  // oppenheimer:end web
];

/**
 * Sorts the changed files. `global` is the files that force a full run,
 * `owners` the packages the owned scripts select, `lintOnly` the files that
 * select nothing.
 */
export function classify(changed) {
  const global = [];
  const lintOnly = [];
  const owners = new Set();
  for (const file of changed) {
    if (LINT_ONLY_PATHS.some((re) => re.test(file))) {
      lintOnly.push(file);
      continue;
    }
    const owned = OWNED_PATHS.find(([re]) => re.test(file));
    if (owned) {
      owners.add(owned[1]);
      continue;
    }
    if (GLOBAL_PATHS.some((re) => re.test(file))) global.push(file);
  }
  return { global, lintOnly, owners: [...owners].sort() };
}

/** The namespaces the API renders (email copy, problem documents); the rest is the browsers'. */
export const API_NAMESPACES = ['emails', 'errors'];

/**
 * Translation copy the API never reads: a namespace file of another area, or
 * a catalog assembled from the namespaces (whose own files say which changed).
 */
export function isCopyTheApiSkips(file) {
  const match = /^packages\/translations\/[a-z]{2}\/([A-Za-z]+)\.json$/.exec(file);
  if (!match) return false;
  if (match[1] === 'index' || match[1] === 'browser') return true;
  return !API_NAMESPACES.includes(match[1]);
}

/**
 * Whether the API's integration and e2e suites have anything to check: a
 * changed file in the API or a package it depends on (`apiDirs`), other than
 * copy it never reads. `@oppenheimer/api` depends on the translations for its
 * emails, so without this a change to the console's copy alone would run both.
 */
export function apiSuitesNeeded(changed, apiDirs) {
  return changed.some(
    (file) => apiDirs.some((dir) => file.startsWith(`${dir}/`)) && !isCopyTheApiSkips(file),
  );
}
