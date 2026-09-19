/**
 * The root barrel, and it is deliberately incomplete.
 *
 * `apps/web` cannot import runtime values from here — the CJS build is not
 * tree-shakeable, so whatever this re-exports lands in the browser bundle whole.
 * That is why `./agents` and `./protocol` are **not** re-exported: the coding-agent
 * catalog and the runner link's wire vocabulary are reached through their own
 * subpaths (`@oppenheimer/shared/agents`, `@oppenheimer/shared/protocol`) by the
 * API and the runner tooling that actually need them.
 *
 * Adding a barrel export here is a bundle decision, not a convenience.
 */
export * from './constants';
export * from './permissions';
export * from './schemas';
export * from './scopes';
export * from './types';
