import { describe, expect, it } from 'vitest';
import {
  activityPhrases,
  humaniseToolName,
  planItems,
  runningStep,
  toolAction,
  toolTarget,
} from '../lib/tool-activity';

/**
 * How the chat words a bot's tool calls: plain verbs, never the tools' own
 * names. The regressions this guards: "WebSearch" or "mcp__oppenheimer__x"
 * on screen, a run of searches read as one search for the first query, and
 * a settled line still saying a call is running.
 */

const call = (name: string, input: Record<string, unknown> = {}) => ({ name, input });

describe('toolAction', () => {
  it('reads a web search with its query, from either engine', () => {
    expect(toolAction(call('WebSearch', { query: ' bun vs node ' }))).toEqual({
      kind: 'search',
      query: 'bun vs node',
    });
    expect(toolAction(call('web_search', {}))).toEqual({ kind: 'search', query: undefined });
  });

  it('reads the to-do list as the plan, and any other tool by its name in words', () => {
    expect(toolAction(call('TodoWrite', { todos: [] }))).toEqual({ kind: 'plan' });
    expect(toolAction(call('mcp__oppenheimer__read_document'))).toEqual({
      kind: 'tool',
      label: 'Read document',
    });
  });
});

describe('humaniseToolName', () => {
  it('splits snake, kebab and camel case, keeps acronyms, and drops the MCP prefix', () => {
    expect(humaniseToolName('remember_fact')).toBe('Remember fact');
    expect(humaniseToolName('createGitHubIssue')).toBe('Create git hub issue');
    expect(humaniseToolName('fetch-URL')).toBe('Fetch URL');
    expect(humaniseToolName('mcp__my_server__list-events')).toBe('List events');
  });
});

describe('activityPhrases', () => {
  it('folds calls in a row that did the same thing into one counted phrase', () => {
    expect(
      activityPhrases([
        call('WebSearch', { query: 'a' }),
        call('WebSearch', { query: 'b' }),
        call('TodoWrite'),
        call('TodoWrite'),
        call('read_document'),
        call('WebSearch', { query: 'c' }),
      ]),
    ).toEqual([
      // Two searches are no longer one query: the phrase drops it.
      { kind: 'search', query: undefined, count: 2 },
      { kind: 'plan', count: 2 },
      { kind: 'tool', label: 'Read document', count: 1 },
      { kind: 'search', query: 'c', count: 1 },
    ]);
  });
});

describe('runningStep', () => {
  it('is the call with no output yet, and nothing once every call answered', () => {
    const done = { output: 'ok' };
    const open = { output: null };
    expect(runningStep([done, open])).toBe(open);
    expect(runningStep([done, { output: '' }])).toBeUndefined();
  });
});

describe('toolTarget', () => {
  it('is the first text the call was given, on one line and cut short', () => {
    expect(toolTarget({ limit: 3, path: 'src/index.ts' })).toBe('src/index.ts');
    expect(toolTarget({ command: 'ls\npwd' })).toBe('ls');
    expect(toolTarget({ query: 'x'.repeat(100) })).toBe(`${'x'.repeat(80)}…`);
    expect(toolTarget({ limit: 3 })).toBeUndefined();
  });
});

describe('planItems', () => {
  it('reads the to-do list with each item’s state, skipping what is not an item', () => {
    expect(
      planItems({
        todos: [
          { content: 'Search', status: 'completed' },
          { content: 'Compare', status: 'in_progress' },
          { content: 'Write it up', status: 'pending' },
          { status: 'pending' },
          'junk',
        ],
      }),
    ).toEqual([
      { text: 'Search', state: 'done' },
      { text: 'Compare', state: 'active' },
      { text: 'Write it up', state: 'pending' },
    ]);
    expect(planItems({})).toEqual([]);
  });
});
