import { chatItemSchema } from '@oppenheimer/shared/schemas/chat-item';
import { describe, expect, it } from 'vitest';
import { toolItem } from '../chat-items';
import { classifyTool } from '../chat-tools';

/**
 * The one builder both adapters put a call through. The regressions this
 * guards: an item that disagrees with the classification it was built from
 * (a page opened read as a search because the builder looked at the raw
 * name again), a kind's own fields read from the wrong place, and an item
 * the shared schema refuses.
 */

const call = (tool: string) => ({
  id: 'c1',
  tool,
  status: 'completed' as const,
  startedAt: new Date('2026-10-21T09:00:00.000Z'),
  completedAt: null,
  output: 'ok',
});

describe('toolItem', () => {
  it('takes a web call’s action from its classification, not from the tool’s name', () => {
    const fetch = classifyTool('WebFetch', { url: 'https://a.dev' }, 'agent');
    expect(toolItem(fetch, call('WebFetch'))).toMatchObject({ action: 'open', query: null });
    expect(toolItem({ ...fetch, opensPage: false }, call('WebFetch'))).toMatchObject({
      action: 'search',
      query: 'https://a.dev',
    });
  });

  it('fills each kind from the classification’s target and the source’s detail', () => {
    const edit = classifyTool('Edit', { file_path: 'src/a.ts' }, 'agent');
    expect(toolItem(edit, call('Edit'), { diff: { additions: 2, deletions: 1 } })).toMatchObject({
      type: 'file_change',
      path: 'src/a.ts',
      kind: 'edit',
      additions: 2,
      deletions: 1,
    });
    const bash = classifyTool('Bash', { command: 'ls' }, 'agent');
    expect(toolItem(bash, call('Bash'))).toMatchObject({ type: 'command', command: 'ls' });
    const mcp = classifyTool('mcp__github__get_issue', {}, 'agent');
    expect(toolItem(mcp, call('mcp__github__get_issue'))).toMatchObject({
      server: 'github',
      name: 'get_issue',
    });
    const task = classifyTool('Task', { subagent_type: 'explore' }, 'agent');
    expect(toolItem(task, call('Task'))).toMatchObject({ type: 'subagent', tasks: 1 });
  });

  it('builds items the shared schema accepts, for every kind', () => {
    const names = [
      'Bash',
      'Read',
      'Edit',
      'Write',
      'Grep',
      'WebSearch',
      'TodoWrite',
      'Task',
      'ExitPlanMode',
      'AskUserQuestion',
      'mcp__x__y',
      'Skill',
    ];
    for (const name of names) {
      const item = toolItem(classifyTool(name, {}, 'agent'), call(name));
      expect(chatItemSchema.safeParse(item).success).toBe(true);
    }
  });
});
