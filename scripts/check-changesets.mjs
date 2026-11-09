#!/usr/bin/env node
// The pending changesets assemble into a release plan, the way the Release
// workflow's `changeset version` assembles them on main. A changeset that
// names an ignored package (`.changeset/config.json`) beside versioned ones
// is refused there, after merge; this refuses it in `ci:local` instead.
import { createRequire } from 'node:module';

// `@changesets/cli`'s own copy, so the plan is the one it builds.
const fromCli = createRequire(
  createRequire(import.meta.url).resolve('@changesets/cli/package.json'),
);
const getReleasePlan = fromCli('@changesets/get-release-plan').default;

try {
  const plan = await getReleasePlan(process.cwd());
  console.log(`${plan.changesets.length} changesets assemble into a release plan.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
