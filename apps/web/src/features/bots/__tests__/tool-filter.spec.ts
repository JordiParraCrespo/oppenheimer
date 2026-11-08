// @vitest-environment node
import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { countToolViews, filterToolGroups, summarizeToolGroup } from '../lib/tool-filter';

/**
 * The permissions list's filter: a search over a tool's name, spelled with or
 * without its underscores, and its sentence; a view per decision, or the tools
 * the owner set; groups the filter empties drop out. Breaks if a search stops
 * reading the description, or `changed` starts reading the preset's decision.
 */
function tool(over: Partial<BotToolSetting> & { name: string }): BotToolSetting {
  return {
    group: 'self',
    description: '',
    asks: false,
    perCallOnly: false,
    decision: 'allow',
    set: null,
    ...over,
  };
}

const editSoul = tool({ name: 'edit_soul', description: 'Rewrites your SOUL.md.' });
const sendMail = tool({
  name: 'send_mail',
  group: 'mail',
  description: 'Sends an email.',
  decision: 'ask',
});
const mergePr = tool({
  name: 'merge_pull_request',
  group: 'github',
  description: 'Merges a pull request.',
  decision: 'off',
  set: 'off',
});
const groups = [
  { group: 'self' as const, tools: [editSoul] },
  { group: 'mail' as const, tools: [sendMail] },
  { group: 'github' as const, tools: [mergePr] },
];

describe('filterToolGroups', () => {
  it('matches a name typed with spaces, and the sentence', () => {
    expect(filterToolGroups(groups, { query: 'edit soul', view: 'all' })).toEqual([
      { group: 'self', tools: [editSoul] },
    ]);
    expect(filterToolGroups(groups, { query: 'EMAIL', view: 'all' })).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
  });

  it('keeps one decision, or what the owner set, and drops emptied groups', () => {
    expect(filterToolGroups(groups, { query: '', view: 'ask' })).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
    expect(filterToolGroups(groups, { query: '', view: 'changed' })).toEqual([
      { group: 'github', tools: [mergePr] },
    ]);
  });
});

describe('countToolViews', () => {
  it('counts each view under the search', () => {
    const tools = [editSoul, sendMail, mergePr];
    expect(countToolViews(tools, '')).toEqual({ all: 3, allow: 1, ask: 1, off: 1, changed: 1 });
    expect(countToolViews(tools, 'pull')).toEqual({ all: 1, allow: 0, ask: 0, off: 1, changed: 1 });
  });
});

describe('summarizeToolGroup', () => {
  it('says how many tools ask, are off and were set', () => {
    expect(summarizeToolGroup([editSoul, sendMail, mergePr])).toEqual({
      total: 3,
      ask: 1,
      off: 1,
      changed: 1,
    });
  });
});
