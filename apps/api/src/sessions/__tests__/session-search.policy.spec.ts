import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  groupSessionHits,
  SESSION_SEARCH_KINDS,
  sessionSearchText,
} from '../domain/session-search.policy';

/**
 * What a session search reads of a log entry, and how ranked rows become one
 * result per session. The words a hit shows are picked by the same fields
 * the index reads, so the snippet is cut from the text that matched: the
 * last test holds the policy's kinds to the migration that defines the
 * index's function and predicate, which the database alone would let drift
 * (a kind the function does not read is never found; a kind the predicate
 * leaves out turns the search into a sequential scan). The SQL is
 * `session-search.integration.spec.ts`.
 */
describe('session search policy', () => {
  it('reads the words a person or an agent wrote, never ids, hashes, senders or keys', () => {
    expect(
      sessionSearchText('prompt.sent', {
        text: 'Check the cookie domain',
        sender: { kind: 'bot', botId: 'b-1', turnId: 't-1' },
      }),
    ).toBe('Check the cookie domain');
    expect(sessionSearchText('agent.notified', { id: 'n-1', text: 'Opened a PR' })).toBe(
      'Opened a PR',
    );
    expect(
      sessionSearchText('file.shared', {
        id: 'f-1',
        name: 'trace.png',
        mediaType: 'image/png',
        size: 10,
        caption: 'The redirect',
        hasPreview: true,
      }),
    ).toBe('trace.png\nThe redirect');
    expect(sessionSearchText('report.published', { hash: 'deadbeef' })).toBe('');
    expect(sessionSearchText('agent.observed', { state: 'working' })).toBe('');
  });

  it("reads a question's header, question and options, and a permission's title, detail and options", () => {
    expect(
      sessionSearchText('agent.decision', {
        decision: {
          kind: 'question',
          id: 'toolu_1',
          questions: [
            {
              header: 'Store',
              question: 'Which store?',
              multiSelect: false,
              options: [
                { label: 'Redis', description: 'shared' },
                { label: 'Memory', description: null },
              ],
            },
          ],
        },
      }).split('\n'),
    ).toEqual(['Store', 'Which store?', 'Redis', 'Memory', 'shared']);
    expect(
      sessionSearchText('agent.decision', {
        decision: {
          kind: 'permission',
          id: 'hash',
          title: 'Do you want to proceed?',
          detail: 'rm -rf build',
          options: [{ label: 'Yes' }, { label: 'No' }],
        },
      }).split('\n'),
    ).toEqual(['Do you want to proceed?', 'rm -rf build', 'Yes', 'No']);
    expect(sessionSearchText('agent.decision', { decision: null })).toBe('');
  });

  it('reads an agent report off agent.observed, and survives a payload of the wrong shape', () => {
    expect(
      sessionSearchText('agent.observed', {
        state: 'blocked',
        program: { state: 'blocked', title: 'Waiting on CI', message: 'Two checks red' },
      }),
    ).toBe('Waiting on CI\nTwo checks red');
    expect(sessionSearchText('prompt.first', 'not an object')).toBe('');
    expect(sessionSearchText('prompt.first', { text: 42 })).toBe('');
    expect(sessionSearchText('turn.ended', { exitCode: 0, result: '  done  ' })).toBe('done');
  });

  it('groups ranked rows by session, in the order of each session’s best hit', () => {
    expect(
      groupSessionHits([
        { sessionId: 'b', hit: 1 },
        { sessionId: 'b', hit: 2 },
        { sessionId: 'a', hit: 3 },
        { sessionId: 'c', hit: 4 },
        { sessionId: 'a', hit: 5 },
      ]),
    ).toEqual([
      { sessionId: 'b', hits: [1, 2] },
      { sessionId: 'a', hits: [3, 5] },
      { sessionId: 'c', hits: [4] },
    ]);
    expect(groupSessionHits([])).toEqual([]);
  });

  it('lists exactly the kinds the latest migration’s function reads and its index holds', () => {
    const dir = join(__dirname, '../../migrations');
    const defining = readdirSync(dir)
      .filter((file) => file.endsWith('.ts'))
      .sort()
      .map((file) => readFileSync(join(dir, file), 'utf8'))
      .filter((source) => source.includes('IDX_work_session_event_search'));
    const source = defining.at(-1);
    expect(source).toBeDefined();

    const read = new Set([...(source ?? '').matchAll(/WHEN '([^']+)' THEN/g)].map((m) => m[1]));
    const predicate = /WHERE "kind" IN \(([^)]*)\)/.exec(source ?? '')?.[1] ?? '';
    const indexed = new Set([...predicate.matchAll(/'([^']+)'/g)].map((m) => m[1]));
    expect(read.size).toBeGreaterThan(0);
    expect(read).toEqual(new Set(SESSION_SEARCH_KINDS));
    expect(indexed).toEqual(new Set(SESSION_SEARCH_KINDS));
  });
});
