/**
 * The root barrel, and it is deliberately incomplete.
 *
 * `apps/web` cannot import runtime values from here — the CJS build is not
 * tree-shakeable, so whatever this re-exports lands in the browser bundle whole.
 * That is why `./agents`, `./protocol` and `./feature-flags` are **not**
 * re-exported: the coding-agent catalog, the runner link's wire vocabulary and
 * the feature-flag catalog and evaluator are reached through their own subpaths
 * (`@oppenheimer/shared/agents`, `@oppenheimer/shared/protocol`,
 * `@oppenheimer/shared/feature-flags`) by the code that actually needs them.
 *
 * Adding a barrel export here is a bundle decision, not a convenience.
 */
export * from './constants';
export * from './permissions';
export * from './schemas';
export * from './scopes';
export * from './types';
