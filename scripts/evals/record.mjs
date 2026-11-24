#!/usr/bin/env node
// What answers the verification guard's eval check (`.agents/hooks/verification.mjs`)
// besides a green eval, which records itself (`recordEvalOnSuccess`):
//
//   node scripts/evals/record.mjs --skip "<why no eval can see this change>"
//   node scripts/evals/record.mjs --status
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { changeFor, record, recorded } from '../../.agents/hooks/verification.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const [flag, ...rest] = process.argv.slice(2);

if (flag === '--status') {
  const change = changeFor(ROOT, 'evals');
  if (!change) console.log('evals: the branch changes nothing agentic');
  else {
    const ok = recorded(ROOT, 'evals').includes(change.fingerprint);
    console.log(
      `evals: ${change.files.length} files (${change.fingerprint}) ${ok ? 'answered' : 'not yet checked'}`,
    );
    for (const file of change.files) console.log(`  ${file}`);
  }
} else if (flag === '--skip') {
  const why = rest.join(' ').trim();
  if (!why) {
    console.error('evals: --skip needs the reason, e.g. --skip "renames a mapper"');
    process.exit(2);
  }
  const change = record(ROOT, 'evals', { eval: 'skip', note: why });
  console.log(
    change
      ? `evals: recorded as not needing an eval in ${join(ROOT, '.evals/passed.json')}`
      : 'evals: the branch changes nothing agentic; there is nothing to record',
  );
} else {
  console.error('usage: record.mjs --skip "<why>" | --status');
  process.exit(2);
}
