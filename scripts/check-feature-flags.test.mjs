/**
 * The flag hygiene rules against catalogs built for the purpose — the shipped
 * catalog holds one permanent kill switch, which exercises neither expiry nor
 * the warning window.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkFeatureFlags } from './check-feature-flags.mjs';

const flag = (overrides = {}) => ({
  description: 'x',
  kind: 'release',
  owner: 'growth',
  expiresAt: '2026-06-01',
  client: true,
  type: 'boolean',
  defaultValue: false,
  ...overrides,
});

const readerOf = (key) => ({ path: 'src/feature.tsx', text: `useFeatureFlag('${key}')` });

test('a temporary flag past its date fails, naming the owner', () => {
  const { errors } = checkFeatureFlags({
    catalog: { new_checkout: flag() },
    today: '2026-06-01',
    sources: [readerOf('new_checkout')],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /new_checkout: a release flag past its expiry.*Owner: growth/);
});

test('an ops flag never expires, whatever its date says', () => {
  const { errors } = checkFeatureFlags({
    catalog: { kill: flag({ kind: 'ops', expiresAt: '2020-01-01' }) },
    today: '2026-06-01',
    sources: [readerOf('kill')],
  });
  assert.deepEqual(errors, []);
});

test('a flag close to its date warns without failing', () => {
  const { errors, warnings } = checkFeatureFlags({
    catalog: { new_checkout: flag({ expiresAt: '2026-06-10' }) },
    today: '2026-06-01',
    sources: [readerOf('new_checkout')],
  });
  assert.deepEqual(errors, []);
  assert.match(warnings[0], /expires in 9 days/);
});

test('a flag no code reads fails', () => {
  const { errors } = checkFeatureFlags({
    catalog: { orphan: flag({ expiresAt: '2099-01-01' }) },
    today: '2026-06-01',
    sources: [readerOf('something_else')],
  });
  assert.match(errors[0], /orphan: declared in the catalog but read nowhere/);
});

test('a read counts whether it is in a hook, a decorator or the evaluator', () => {
  for (const text of [
    `@RequireFlag('beta')`,
    `evaluator.isEnabled("beta", context)`,
    'useFeatureFlagValue(`beta`)',
  ]) {
    const { errors } = checkFeatureFlags({
      catalog: { beta: flag({ expiresAt: '2099-01-01' }) },
      today: '2026-06-01',
      sources: [{ path: 'x.ts', text }],
    });
    assert.deepEqual(errors, [], text);
  }
});
