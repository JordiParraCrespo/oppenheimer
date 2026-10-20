import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  groupSummary,
  humaniseToolName,
  planItems,
  readableOutput,
  runningStep,
  toolAction,
  toolTarget,
} from '../lib/tool-activity';

describe('readableOutput', () => {
  it('indents JSON and leaves anything else as it came', () => {
    expect(readableOutput('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(readableOutput('PASS 40 tests')).toBe('PASS 40 tests');
    expect(readableOutput('{not json')).toBe('{not json');
  });
});

/**
 * How the chat words a bot's tool calls: plain verbs, never the tools' own
 * names. The regressions this guards: "WebSearch" or "mcp__oppenheimer__x"
 * on screen, a running call drawn as done, and a plan drawn as raw JSON.
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
    expect(toolAction(call('mcp__oppenheimer__read_document', { name: 'notes.md' }))).toEqual({
      kind: 'tool',
      label: 'Read document',
      target: 'notes.md',
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

describe('runningStep', () => {
  const activity = (outputs: (string | null)[]) =>
    ({
      role: 'activity',
      steps: outputs.map((output, index) => ({ callId: String(index), output })),
    }) as unknown as BotMessageEntity;

  it('is the last call with no output yet, across the turn’s runs, and nothing once all answered', () => {
    const running = runningStep([activity(['ok']), activity(['ok', null])]);
    expect(running?.callId).toBe('1');
    expect(runningStep([activity(['ok', ''])])).toBeUndefined();
    expect(runningStep([{ role: 'assistant' } as BotMessageEntity])).toBeUndefined();
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

describe('groupSummary', () => {
  const search = { kind: 'search', query: 'x' } as const;
  const tool = { kind: 'tool', label: 'Read document', target: undefined } as const;

  it('says what a run of searches did, and "used tools" for a mix or any other kind', () => {
    expect(groupSummary([search, search])).toBe('bots.chat.activity.groupSearched');
    expect(groupSummary([search, tool])).toBe('bots.chat.activity.group');
    expect(groupSummary([tool, tool])).toBe('bots.chat.activity.group');
    expect(groupSummary([{ kind: 'plan' }, { kind: 'plan' }])).toBe('bots.chat.activity.group');
  });
});
