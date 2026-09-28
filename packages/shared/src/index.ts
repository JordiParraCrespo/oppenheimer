/**
 * The root barrel, and it is deliberately incomplete.
 *
 * The ESM build is tree-shaken, so a web import from here costs only what it
 * uses. `./agents`, `./protocol`, `./feature-flags` and `./automations` still
 * stay out: the coding-agent catalog, the runner link's wire vocabulary (whose
 * modules register JSON-Schema ids at load, the package's only side effects),
 * the feature-flag catalog and evaluator, and the automation catalog are
 * reached through their own subpaths by the code that actually needs them.
 *
 * Adding a barrel export here is a bundle decision, not a convenience.
 */
export * from './constants';
export * from './permissions';
export * from './schemas';
export * from './scopes';
export * from './types';
