// @vitest-environment node
import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import {
  countToolGroups,
  countToolViews,
  filterToolGroups,
  summarizeToolGroup,
} from '../lib/tool-filter';

/**
 * The permissions list's filter: a search over a tool's name, spelled with or
 * without its underscores, and its sentence; a view per decision, or the tools
 * the owner set; one group alone, where a group the catalog lacks keeps them
 * all; groups the filter empties drop out. Breaks if a search stops reading
 * the description, or `changed` starts reading the preset's decision.
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
    expect(filterToolGroups(groups, { query: 'edit soul', view: 'all', group: 'all' })).toEqual([
      { group: 'self', tools: [editSoul] },
    ]);
    expect(filterToolGroups(groups, { query: 'EMAIL', view: 'all', group: 'all' })).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
  });

  it('keeps one decision, or what the owner set, and drops emptied groups', () => {
    expect(filterToolGroups(groups, { query: '', view: 'ask', group: 'all' })).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
    expect(filterToolGroups(groups, { query: '', view: 'changed', group: 'all' })).toEqual([
      { group: 'github', tools: [mergePr] },
    ]);
  });

  it('keeps one group, and every group for a name the catalog lacks', () => {
    expect(filterToolGroups(groups, { query: '', view: 'all', group: 'mail' })).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
    expect(filterToolGroups(groups, { query: '', view: 'all', group: 'nope' })).toHaveLength(3);
  });
});

describe('the dropdowns’ counts', () => {
  it('count each decision under the search and group, each group under the decision', () => {
    const none = { query: '', view: 'all' as const, group: 'all' };
    expect(countToolViews(groups, none)).toEqual({ all: 3, allow: 1, ask: 1, off: 1, changed: 1 });
    expect(countToolViews(groups, { ...none, query: 'pull' })).toEqual({
      all: 1,
      allow: 0,
      ask: 0,
      off: 1,
      changed: 1,
    });
    expect(countToolGroups(groups, { ...none, view: 'ask', group: 'self' })).toEqual({
      all: 1,
      self: 0,
      mail: 1,
      github: 0,
    });
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
