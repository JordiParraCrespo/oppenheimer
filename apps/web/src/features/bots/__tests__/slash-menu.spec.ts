import { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { skillRowModel } from '../lib/skill-row';
import { matchingCommands, slashMenuItems, slashQuery } from '../lib/slash-menu';

/**
 * What the `/` menu reads of the draft and how a skill's row reads. What breaks
 * this: the menu opening over a message that only starts with a slash, or
 * hiding a skill whose name contains what was typed.
 */
function skill(name: string) {
  const at = new Date();
  return new BotSkillEntity(name, name, '', 'x', true, true, 'user', at, at);
}

describe('slashQuery', () => {
  it('reads the command being typed, and nothing once there is more', () => {
    expect(slashQuery('/')).toBe('');
    expect(slashQuery('/rel')).toBe('rel');
    expect(slashQuery('/rel ')).toBeNull();
    expect(slashQuery('/Rel')).toBeNull();
    expect(slashQuery(' /rel')).toBeNull();
    expect(slashQuery('/rel\n')).toBeNull();
  });
});

describe('matchingCommands', () => {
  it('lists names that start with what is typed first, then those that contain it', () => {
    const names = matchingCommands(
      [skill('pr-review'), skill('review'), skill('triage')],
      'rev',
    ).map((found) => found.name);
    expect(names).toEqual(['review', 'pr-review']);
  });

  it('lists at most eight', () => {
    const many = Array.from({ length: 12 }, (_, i) => skill(`s${i}`));
    expect(matchingCommands(many, '')).toHaveLength(8);
  });
});

describe('slashMenuItems', () => {
  const goal = { id: 'built-in:goal', name: 'goal', command: '/goal', description: '' };

  it('lists the built-ins first, and leaves out a skill under a built-in’s name', () => {
    const { builtIns, skills } = slashMenuItems([goal], [skill('goal'), skill('go-live')], 'go');
    expect(builtIns.map((found) => found.name)).toEqual(['goal']);
    expect(skills.map((found) => found.name)).toEqual(['go-live']);
  });

  it('keeps the two together within the menu’s cap', () => {
    const many = Array.from({ length: 12 }, (_, i) => skill(`s${i}`));
    const { builtIns, skills } = slashMenuItems([goal], many, '');
    expect(builtIns.length + skills.length).toBe(8);
  });
});

describe('skillRowModel', () => {
  it('says who saved it, and tags a skill only one side runs', () => {
    expect(skillRowModel({ source: 'bot', userInvocable: true, modelInvocable: true })).toEqual({
      meta: 'byBot',
      kind: null,
    });
    expect(skillRowModel({ source: 'user', userInvocable: true, modelInvocable: false }).kind).toBe(
      'onlyYou',
    );
    expect(skillRowModel({ source: 'user', userInvocable: false, modelInvocable: true }).kind).toBe(
      'onlyBot',
    );
  });
});
