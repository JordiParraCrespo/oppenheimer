import { describe, expect, it } from 'vitest';
import {
  classifyTool,
  fieldOf,
  humaniseToolName,
  todosOf,
  toolIcon,
  toolLine,
} from '../chat-tools';

/**
 * One reading of a tool call for both chats. The regressions this guards: a
 * tool the two chats name differently (`WebSearch` a search in one, a bare
 * tool in the other), a bot's own tool shown as `mcp__oppenheimer__x`, a
 * third-party MCP tool humanised past its server's name, and a target read
 * off the wrong field.
 */
describe('classifyTool', () => {
  it('reads Claude Code’s tools in a session by what they do and what they acted on', () => {
    expect(
      classifyTool('Bash', { command: 'pnpm test', description: 'Run tests' }, 'agent'),
    ).toEqual({
      kind: 'command',
      type: 'command',
      icon: 'terminal',
      label: 'Bash',
      target: 'pnpm test',
      opensPage: false,
    });
    expect(classifyTool('Read', { file_path: 'src/a.ts', limit: 20 }, 'agent')).toMatchObject({
      kind: 'read',
      type: 'file_read',
      target: 'src/a.ts',
    });
    expect(classifyTool('MultiEdit', { file_path: 'src/a.ts', edits: [] }, 'agent')).toMatchObject({
      kind: 'edit',
      type: 'file_change',
      icon: 'file-edit',
    });
    expect(classifyTool('Grep', { pattern: 'TODO', path: 'src' }, 'agent').target).toBe('TODO');
    expect(classifyTool('Task', { subagent_type: 'explore', prompt: 'x' }, 'agent')).toMatchObject({
      kind: 'agent',
      type: 'subagent',
      target: 'explore',
    });
    expect(classifyTool('WebFetch', { url: 'https://a.dev', prompt: 'x' }, 'agent')).toMatchObject({
      kind: 'web',
      type: 'web_search',
      target: 'https://a.dev',
      opensPage: true,
    });
  });

  it('names a session’s MCP and unknown tools as the CLI does, pointed at a known field or nothing', () => {
    expect(classifyTool('mcp__github__get_issue', { owner: 'o', number: 1 }, 'agent')).toEqual({
      kind: 'mcp',
      type: 'mcp_tool_call',
      icon: 'plug',
      label: 'github · get_issue',
      target: null,
      opensPage: false,
    });
    expect(classifyTool('Skill', { skill: 'deslop' }, 'agent')).toMatchObject({
      kind: 'other',
      type: 'tool_call',
      label: 'Skill',
      target: null,
    });
  });

  it('reads the same built-in the same way in a bot’s chat, under either engine’s name', () => {
    for (const name of ['WebSearch', 'web_search', 'web_search_preview']) {
      expect(classifyTool(name, { query: 'bun vs node' }, 'bot')).toMatchObject({
        kind: 'web',
        target: 'bun vs node',
        opensPage: false,
      });
    }
    expect(classifyTool('WebSearch', { query: 'q' }, 'agent').kind).toBe('web');
    expect(classifyTool('TodoWrite', { todos: [] }, 'bot').type).toBe('todo_list');
    expect(classifyTool('mcp__oppenheimer__delegate', { tasks: [] }, 'bot').type).toBe('subagent');
  });

  it('reads a bot’s own tool in words, pointed at the first text it was given', () => {
    expect(classifyTool('mcp__oppenheimer__read_document', { name: 'notes.md' }, 'bot')).toEqual({
      kind: 'other',
      type: 'tool_call',
      icon: 'tool',
      label: 'Read document',
      target: 'notes.md',
      opensPage: false,
    });
    expect(classifyTool('get_pull_request_file', { limit: 3, path: 'a.ts' }, 'bot').target).toBe(
      'a.ts',
    );
    expect(classifyTool('remember_fact', { limit: 3 }, 'bot').target).toBeNull();
  });
});

describe('toolIcon', () => {
  it('gives each kind its own glyph name, and every unknown tool one glyph', () => {
    expect(toolIcon('write')).toBe('file-new');
    expect(toolIcon('other')).toBe('tool');
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

describe('toolLine', () => {
  it('is the first line, trimmed and cut short', () => {
    expect(toolLine('  ls\npwd')).toBe('ls');
    expect(toolLine('x'.repeat(100))).toBe(`${'x'.repeat(80)}…`);
  });
});

describe('fieldOf', () => {
  it('is the first of the keys the input holds as text, skipping blanks and non-text', () => {
    expect(fieldOf({ description: '  ', prompt: 'Explore', n: 3 }, ['description', 'prompt'])).toBe(
      'Explore',
    );
    expect(fieldOf({ n: 3 }, ['n', 'plan'])).toBeNull();
  });
});

describe('todosOf', () => {
  it('reads a TodoWrite list the same way for both chats: trimmed, blanks dropped, unknown status pending', () => {
    expect(
      todosOf([
        { content: ' Search ', status: 'completed' },
        { content: 'Compare', status: 'in_progress' },
        { content: 'Write it up', status: 'later' },
        { content: '  ', status: 'pending' },
        { status: 'pending' },
        'junk',
      ]),
    ).toEqual([
      { text: 'Search', status: 'completed' },
      { text: 'Compare', status: 'in_progress' },
      { text: 'Write it up', status: 'pending' },
    ]);
    expect(todosOf(undefined)).toEqual([]);
  });
});

describe('the origin’s reading of a tool the table does not know', () => {
  it('keeps a bot’s own server out of MCP, and a third-party server in it', () => {
    expect(classifyTool('mcp__oppenheimer__start_session', { task: 'x' }, 'bot').kind).toBe(
      'other',
    );
    expect(classifyTool('mcp__notion__search', { query: 'q' }, 'bot')).toMatchObject({
      kind: 'mcp',
      label: 'Search',
      target: 'q',
    });
    expect(classifyTool('mcp__oppenheimer__x', {}, 'agent').kind).toBe('mcp');
  });
});
