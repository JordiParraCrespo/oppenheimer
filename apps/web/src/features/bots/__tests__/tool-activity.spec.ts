import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  groupSummary,
  humaniseToolName,
  liveLabel,
  liveWords,
  planItems,
  readableOutput,
  runningStep,
  sharedKind,
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
    expect(toolAction(call('delegate', { tasks: [{ task: 'a' }, { task: 'b' }] }))).toEqual({
      kind: 'delegate',
      tasks: 2,
    });
    expect(toolAction(call('mcp__oppenheimer__read_document', { name: 'notes.md' }))).toEqual({
      kind: 'tool',
      label: 'Read document',
      target: 'notes.md',
    });
  });
});

describe('liveWords', () => {
  it('says what a running call is doing, by its kind, with what it was pointed at', () => {
    expect(liveWords({ kind: 'search', query: 'bun' })).toEqual({
      key: 'bots.chat.activity.searchingFor',
      values: { query: 'bun' },
    });
    expect(liveWords({ kind: 'search', query: undefined }).key).toBe(
      'bots.chat.activity.searching',
    );
    expect(liveWords({ kind: 'plan' }).key).toBe('bots.chat.activity.planning');
    expect(liveWords({ kind: 'delegate', tasks: 3 })).toEqual({
      key: 'bots.chat.activity.delegating',
      values: { count: 3 },
    });
    expect(liveWords({ kind: 'tool', label: 'Get session', target: 'x' })).toEqual({
      key: 'bots.chat.activity.using',
      values: { name: 'Get session' },
    });
  });
});

describe('liveLabel', () => {
  const delegate = {
    callId: 'c1',
    name: 'delegate',
    input: { tasks: [{ task: 'a' }, { task: 'b' }] },
    output: null,
    isError: false,
    sessionId: null,
    subagents: null,
    allowedBy: null,
    mailDraft: null,
  };
  const run = (state: 'running' | 'completed' | 'failed') => ({
    task: 'x',
    state,
    toolCalls: [],
    startedAt: null,
    durationMs: null,
  });

  it('counts a delegate call’s ended children, failures included, once one has ended', () => {
    expect(
      liveLabel({
        queued: false,
        step: delegate,
        subagents: [run('completed'), run('failed'), run('running')],
        writing: false,
      }),
    ).toEqual({ key: 'bots.chat.activity.delegatingDone', values: { count: 3, done: 2 } });
  });

  it('says what the call is doing while none has ended, and Waiting before anything while queued', () => {
    const live = { step: delegate, subagents: [run('running')], writing: false };
    expect(liveLabel({ queued: false, ...live }).key).toBe('bots.chat.activity.delegating');
    expect(liveLabel({ queued: true, ...live }).key).toBe('bots.chat.turn.queued');
    expect(
      liveLabel({ queued: false, step: undefined, subagents: undefined, writing: true }).key,
    ).toBe('bots.chat.turn.writing');
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

describe('sharedKind', () => {
  it('names the kind a run shares, and nothing for a mix, so a mixed group takes the tool glyph', () => {
    const search = { kind: 'search', query: 'x' } as const;
    expect(sharedKind([search, search])).toBe('search');
    expect(sharedKind([search, { kind: 'plan' }])).toBeUndefined();
  });
});
