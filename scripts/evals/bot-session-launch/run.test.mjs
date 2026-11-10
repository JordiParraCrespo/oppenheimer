// The eval's grader: what makes a case pass, without a bot or an API. What
// breaks this: an eval that passes a bot which started a session on the
// host's default when the person named a model, or one that escalated to
// full access nobody asked for.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { grade, messageOf } from './run.mjs';

const card = (input, summary) => ({ card: { input, summary }, started: false, reply: '' });

test('passes a card that says what the person asked for and carries nothing else', () => {
  const testCase = {
    card: ['Opus 5.5', 'high effort'],
    input: { effort: 'high' },
    absent: ['permission'],
  };
  const observed = card(
    { task: 'x', model: 'opus 5.5', effort: 'high' },
    'Start Claude Code (Opus 5.5, high effort) on build-02 in acme/app: x',
  );
  assert.deepEqual(grade(testCase, observed), { pass: true, failures: [] });
});

test('fails a session launched on the default when a model was named', () => {
  const verdict = grade(
    { card: ['Opus 5.5'] },
    card({ task: 'x' }, 'Start Claude Code on build-02 in acme/app: x'),
  );
  assert.equal(verdict.pass, false);
  assert.match(verdict.failures[0], /does not say "Opus 5\.5"/);
});

test('fails a choice nobody made, such as full access', () => {
  const verdict = grade(
    { absent: ['permission'] },
    card({ task: 'x', permission: 'full' }, 'Start Claude Code (full access) on build-02: x'),
  );
  assert.equal(verdict.pass, false);
  assert.match(verdict.failures[0], /permission is "full", which nobody asked for/);
});

test('fails a turn that raised no card, quoting what the bot said instead', () => {
  const verdict = grade(
    { card: ['Opus 5.5'] },
    { card: null, started: false, reply: "I can't choose the model when I start a session." },
  );
  assert.equal(verdict.pass, false);
  assert.match(verdict.failures[0], /no start_session card; the bot said: I can't choose/);
});

test('fails a bot that started a session without asking: the eval needs Approve for me', () => {
  const verdict = grade({}, { card: null, started: true, reply: 'Started.' });
  assert.equal(verdict.pass, false);
  assert.match(verdict.failures[0], /Approve for me/);
});

test('passes a refused model only with no card and a reply that offers the real ones', () => {
  const testCase = { refused: true, mentions: ['Opus 5.5'] };
  assert.equal(
    grade(testCase, {
      card: null,
      started: false,
      reply: 'There is no Opus 9. Opus 5.5 is the newest.',
    }).pass,
    true,
  );
  assert.equal(
    grade(testCase, card({ task: 'x', model: 'Opus 5.5' }, 'Start Claude Code (Opus 5.5): x')).pass,
    false,
  );
  assert.equal(
    grade(testCase, { card: null, started: false, reply: "I can't choose a model; Opus 5.5 runs." })
      .pass,
    false,
  );
});

test('every case is well formed and names the project', () => {
  const { cases } = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
  assert.ok(cases.length > 0);
  const ids = new Set();
  for (const testCase of cases) {
    assert.ok(!ids.has(testCase.id), `duplicate case ${testCase.id}`);
    ids.add(testCase.id);
    assert.match(messageOf(testCase, 'acme'), /acme/, `${testCase.id} names no project`);
    if (testCase.refused) assert.ok(testCase.mentions?.length, `${testCase.id} needs mentions`);
  }
});
