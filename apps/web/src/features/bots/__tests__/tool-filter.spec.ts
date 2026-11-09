// @vitest-environment node
import type { BotToolSetting } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { deriveToolList, summarizeToolGroup } from '../lib/tool-filter';
import { toToolView } from '../lib/tool-search';

/**
 * The permissions list's filter: a search over a tool's name, spelled with or
 * without its underscores, and its sentence; a view per decision, or the tools
 * the owner set; one group alone, where a group the catalog lacks keeps them
 * all; groups the filter empties drop out; each dropdown option counts the
 * list it would draw. Breaks if a search stops reading the description, or
 * `changed` starts reading the preset's decision.
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

const none = { query: '', view: 'all' as const, group: 'all' };

describe('deriveToolList', () => {
  it('matches a name typed with spaces, and the sentence', () => {
    expect(deriveToolList(groups, { ...none, query: 'edit soul' }).groups).toEqual([
      { group: 'self', tools: [editSoul] },
    ]);
    expect(deriveToolList(groups, { ...none, query: 'EMAIL' }).groups).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
  });

  it('keeps one decision, or what the owner set, and drops emptied groups', () => {
    expect(deriveToolList(groups, { ...none, view: 'ask' }).groups).toEqual([
      { group: 'mail', tools: [sendMail] },
    ]);
    expect(deriveToolList(groups, { ...none, view: 'changed' }).groups).toEqual([
      { group: 'github', tools: [mergePr] },
    ]);
  });

  it('keeps one group, and every group for a name the catalog lacks', () => {
    const mail = deriveToolList(groups, { ...none, group: 'mail' });
    expect(mail.groups).toEqual([{ group: 'mail', tools: [sendMail] }]);
    expect(mail.group).toBe('mail');
    const unknown = deriveToolList(groups, { ...none, group: 'nope' });
    expect(unknown.groups).toHaveLength(3);
    expect(unknown).toMatchObject({ group: 'all', filtering: false });
  });

  it('counts each decision under the search and group, each group under the decision', () => {
    expect(deriveToolList(groups, none)).toMatchObject({
      views: { all: 3, allow: 1, ask: 1, off: 1, changed: 1 },
      filtering: false,
    });
    expect(deriveToolList(groups, { ...none, query: 'pull' }).views).toEqual({
      all: 1,
      allow: 0,
      ask: 0,
      off: 1,
      changed: 1,
    });
    expect(deriveToolList(groups, { ...none, view: 'ask', group: 'self' })).toMatchObject({
      groupCounts: { all: 1, self: 0, mail: 1, github: 0 },
      groups: [],
      filtering: true,
    });
  });
});

describe('toToolView', () => {
  it('reads a menu value back as a view, and anything else as every tool', () => {
    expect(toToolView('changed')).toBe('changed');
    expect(toToolView('nope')).toBe('all');
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
