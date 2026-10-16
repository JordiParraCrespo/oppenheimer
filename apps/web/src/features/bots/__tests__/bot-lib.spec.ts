import type {
  BotDocumentRevisionEntity,
  BotEntity,
  BotGroupEntity,
} from '@oppenheimer/frontend-consumer';
import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import {
  botEffort,
  botEngineValue,
  botModel,
  botProviderOptions,
  providerOfMark,
} from '../lib/bot-engine';
import { botSections, firstBot } from '../lib/bot-groups';
import { revisionNote } from '../lib/revision-note';

/**
 * What the Employees sidebar draws from the bots and the groups, and the two
 * readings the chat and the revision history make of the API's rows.
 */

const bot = (id: string, groupId: string | null, position: number, name = id) =>
  ({ id, name, groupId, position }) as BotEntity;
const group = (id: string, position: number, name = id) =>
  ({ id, name, position }) as BotGroupEntity;

const ids = (sections: ReturnType<typeof botSections>) =>
  sections.map((section) => [section.id, section.bots.map((row) => row.id)]);

describe('botSections', () => {
  const groups = [group('research', 1), group('engineering', 0)];
  const bots = [
    bot('quota', 'engineering', 1, 'Quota Bot'),
    bot('release', 'engineering', 0, 'Release Bot'),
    bot('fresh', null, 0, 'New Bot'),
    bot('scholar', 'research', 0, 'Research Bot'),
  ];

  it('draws the groups in their order, each bot by position, and Ungrouped last', () => {
    expect(ids(botSections(bots, groups, ''))).toEqual([
      ['engineering', ['release', 'quota']],
      ['research', ['scholar']],
      [null, ['fresh']],
    ]);
  });

  it('keeps an empty group, somewhere to move a bot, but no empty Ungrouped', () => {
    const sections = botSections([bot('release', 'engineering', 0)], [...groups], '');
    expect(ids(sections)).toEqual([
      ['engineering', ['release']],
      ['research', []],
    ]);
  });

  it('narrows to the bots whose name matches, whatever its case, and drops empty sections', () => {
    expect(ids(botSections(bots, groups, '  RESEARCH '))).toEqual([['research', ['scholar']]]);
    expect(botSections(bots, groups, 'nobody')).toEqual([]);
  });

  it('counts a bot whose group the groups read does not hold yet as Ungrouped', () => {
    expect(ids(botSections([bot('moved', 'brand-new', 0)], [], ''))).toEqual([[null, ['moved']]]);
  });
});

describe('botModel and botEffort', () => {
  it('names the provider’s default model for a bot that has not picked one', () => {
    expect(botModel('anthropic', null)).toBe('claude-opus-5-5');
    expect(botModel('glm', null)).toBe('glm-5.3');
    expect(botModel('anthropic', 'claude-haiku-4-5')).toBe('claude-haiku-4-5');
  });

  it('shows the bot’s level when its model offers it, the model’s default when not', () => {
    expect(botEffort('anthropic', 'claude-fable-5-1', 'low')?.value).toBe('low');
    expect(botEffort('anthropic', 'claude-fable-5-1', 'ultra')?.value).toBe('high');
  });

  it('draws no effort for a model that takes none', () => {
    expect(botEffort('anthropic', 'claude-haiku-4-5', 'medium')).toBeNull();
  });
});

describe('the model button', () => {
  it('maps a pick back to the provider whose group it is in', () => {
    expect(providerOfMark(botEngineValue('openai', null).agent)).toBe('openai');
    expect(providerOfMark(botEngineValue('glm', null).agent)).toBe('glm');
    expect(providerOfMark('grok')).toBeUndefined();
    expect(botEngineValue('anthropic', null)).toEqual({
      agent: 'claude-code',
      model: 'claude-opus-5-5',
    });
  });
});

describe('revisionNote', () => {
  const t = ((key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key) as unknown as TFunction;
  const revision = (patch: Partial<BotDocumentRevisionEntity>) =>
    ({
      name: 'instructions',
      revision: 2,
      note: '',
      revertedFrom: null,
      ...patch,
    }) as BotDocumentRevisionEntity;

  it('prefers what the writer said', () => {
    expect(revisionNote(revision({ note: 'Tone down' }), t)).toBe('Tone down');
  });

  it('says a revert restored which revision, revision 1 is the creation, any other an edit', () => {
    expect(revisionNote(revision({ revertedFrom: 1, revision: 4 }), t)).toBe(
      'bots.settings.instructions.reverted:{"revision":1}',
    );
    expect(revisionNote(revision({ revision: 1 }), t)).toBe('bots.settings.instructions.created');
    expect(revisionNote(revision({}), t)).toBe(
      'bots.settings.instructions.edited:{"file":"INSTRUCTIONS.md"}',
    );
  });
});

describe('botProviderOptions', () => {
  const groups = (options: ReturnType<typeof botProviderOptions>) =>
    options.map((option) => providerOfMark(option.id));

  it('offers only the providers the workspace has set up, in catalog order', () => {
    expect(groups(botProviderOptions(['openai', 'anthropic'], 'anthropic'))).toEqual([
      'anthropic',
      'openai',
    ]);
  });

  it("keeps the bot's own provider when it has no key, so its model still shows", () => {
    expect(groups(botProviderOptions(['openai'], 'glm'))).toEqual(['glm', 'openai']);
    expect(groups(botProviderOptions([], 'anthropic'))).toEqual(['anthropic']);
  });
});

describe('firstBot', () => {
  it('is the bot the sidebar draws first: the first group by position, then Ungrouped', () => {
    const groups = [group('later', 1), group('first', 0)];
    const bots = [bot('loose', null, 0), bot('b', 'first', 1), bot('a', 'first', 0)];
    expect(firstBot(bots, groups)?.id).toBe('a');
    expect(firstBot([bot('loose', null, 0)], groups)?.id).toBe('loose');
  });

  it('is undefined for a workspace with no bots, which keeps the greeting', () => {
    expect(firstBot([], [group('g', 0)])).toBeUndefined();
  });
});
