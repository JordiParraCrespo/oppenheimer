import type { PullRequestLane } from '@oppenheimer/shared';

/**
 * Why a pull request is in its lane, as a code the console words: the lane
 * policy decides from what code can read, never from a model
 * (`product/next-steps/0.2-pull-requests-api-plan.md` §4.3).
 */
export type LaneReason =
  | { code: 'risky_path'; path: string }
  | { code: 'large_change'; lines: number }
  | { code: 'docs_tests_config'; files: number }
  | { code: 'small_change'; lines: number; files: number }
  | { code: 'medium_change'; lines: number; files: number };

export interface LaneDecision {
  lane: PullRequestLane;
  reason: LaneReason;
}

/** Where a change needs a careful reader whatever its size. */
const RISKY = [
  /(^|\/)(auth|authz|migrations?|deploy|secrets?|security|billing|infra)\//i,
  /^\.github\/workflows\//,
  /(^|\/)protocol\//i,
];
/** Reading that rarely hides a bug: docs, tests, lockfiles and CI configuration. */
const LIGHT = [
  /\.(md|mdx|txt|rst)$/i,
  /(^|\/)docs?\//i,
  /(^|\/)(__tests__|tests?|e2e)\//i,
  /\.(spec|test)\.[a-z]+$/i,
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|go\.sum)$/,
  /(^|\/)\.github\/[^/]+\.ya?ml$/,
];

export const DEEP_LINES = 1000;
const QUICK_LIGHT_LINES = 400;
const QUICK_LINES = 150;
const QUICK_FILES = 5;

/**
 * Deep: a risky path, or over a thousand changed lines. Quick: docs, tests and
 * configuration only, or a small change in few files. Medium: everything else.
 */
export function decideLane(
  paths: readonly string[],
  additions: number,
  deletions: number,
): LaneDecision {
  const lines = additions + deletions;
  const risky = paths.find((path) => RISKY.some((pattern) => pattern.test(path)));
  if (risky) return { lane: 'deep', reason: { code: 'risky_path', path: riskyDirectory(risky) } };
  if (lines > DEEP_LINES) return { lane: 'deep', reason: { code: 'large_change', lines } };
  if (
    paths.length > 0 &&
    lines <= QUICK_LIGHT_LINES &&
    paths.every((path) => LIGHT.some((p) => p.test(path)))
  ) {
    return { lane: 'quick', reason: { code: 'docs_tests_config', files: paths.length } };
  }
  if (lines <= QUICK_LINES && paths.length <= QUICK_FILES) {
    return { lane: 'quick', reason: { code: 'small_change', lines, files: paths.length } };
  }
  return { lane: 'medium', reason: { code: 'medium_change', lines, files: paths.length } };
}

/** `apps/api/src/auth/guard.ts` → `auth/`: the directory the rule matched, as the reader thinks of it. */
function riskyDirectory(path: string): string {
  for (const pattern of RISKY) {
    const match = pattern.exec(path);
    if (match) return match[0].replace(/^\//, '');
  }
  return path;
}
