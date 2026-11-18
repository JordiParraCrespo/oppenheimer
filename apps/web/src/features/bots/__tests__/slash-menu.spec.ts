import { BotSkillEntity } from '@oppenheimer/frontend-consumer';
import { describe, expect, it } from 'vitest';
import { builtInCommandActionOf } from '../lib/built-in-command';
import { skillRowModel } from '../lib/skill-row';
import {
  leadingCommand,
  matchingCommands,
  slashMenuItems,
  slashMenuRows,
  slashQuery,
} from '../lib/slash-menu';

/**
 * What the `/` menu reads of the draft and how a skill's row reads. What breaks
 * this: the menu opening over a message that only starts with a slash, or
 * hiding a skill whose name contains what was typed, or one whose `/<name>`
 * still runs it.
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

  it('still offers a skill saved under a built-in skill’s name, since /<name> runs that skill', () => {
    const { skills } = slashMenuItems([goal], [skill('oppenheimer')], 'opp');
    expect(skills.map((found) => found.name)).toEqual(['oppenheimer']);
  });

  it('keeps the two together within the menu’s cap', () => {
    const many = Array.from({ length: 12 }, (_, i) => skill(`s${i}`));
    const { builtIns, skills } = slashMenuItems([goal], many, '');
    expect(builtIns.length + skills.length).toBe(8);
  });
});

describe('builtInCommandActionOf', () => {
  it('holds /goal with no condition, runs /goal clear here, and sends everything else', () => {
    expect(builtInCommandActionOf('/goal ')).toEqual({
      kind: 'notice',
      notice: 'goalNeedsCondition',
    });
    expect(builtInCommandActionOf('/goal off')).toEqual({ kind: 'local', action: 'clearGoal' });
    expect(builtInCommandActionOf('/goal CI is green')).toBeNull();
    expect(builtInCommandActionOf('/release-notes v2')).toBeNull();
  });

  it('holds a /loop interval out of range, runs /loop stop here, and sends every other /loop', () => {
    expect(builtInCommandActionOf('/loop 0m check')).toEqual({
      kind: 'notice',
      notice: 'loopBadInterval',
    });
    expect(builtInCommandActionOf('/loop stop')).toEqual({ kind: 'local', action: 'clearLoop' });
    expect(builtInCommandActionOf('/loop 5m check the deploy')).toBeNull();
    expect(builtInCommandActionOf('/loop')).toBeNull();
  });

  it('opens the routines for /schedule alone, and sends a /schedule with a request', () => {
    expect(builtInCommandActionOf('/schedule')).toEqual({ kind: 'local', action: 'openRoutines' });
    expect(builtInCommandActionOf('/schedule every weekday at 9, check PRs')).toBeNull();
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

describe('slashMenuRows', () => {
  const key = (k: string) => k;
  const names = (rows: { name: string }[]) => rows.map((row) => row.name);
  const own = (name: string, userInvocable = true) =>
    new BotSkillEntity(
      name,
      name,
      `Own ${name}`,
      'x',
      userInvocable,
      true,
      'user',
      new Date(),
      new Date(),
    );

  it('offers /recap before the bot’s own skills, so a long list never pushes it out', () => {
    const many = Array.from({ length: 12 }, (_, i) => own(`s${i}`));
    const { builtIns, skills } = slashMenuRows('', many, key);
    expect(names(builtIns)).toEqual(['goal', 'usage', 'loop', 'schedule']);
    expect(skills[0]).toMatchObject({
      name: 'recap',
      description: 'bots.chat.slash.builtInSkill.recap',
    });
  });

  it('gives way to a skill of the bot’s own saved as recap, since /recap runs that one', () => {
    const { skills } = slashMenuRows('rec', [own('recap')], key);
    expect(skills).toEqual([expect.objectContaining({ name: 'recap', description: 'Own recap' })]);
  });

  it('offers no /recap when the bot’s own recap is only the bot’s to use, since /recap would answer "not one of your skills"', () => {
    expect(slashMenuRows('rec', [own('recap', false)], key).skills).toEqual([]);
  });

  it('leaves out a skill of the bot’s own that only the bot may use', () => {
    expect(names(slashMenuRows('', [own('deploy', false), own('triage')], key).skills)).toEqual([
      'recap',
      'triage',
    ]);
  });

  it('offers the commands alone until the bot’s skills are read, since one of its own may take a built-in skill’s name', () => {
    const { builtIns, skills } = slashMenuRows('', undefined, key);
    expect(names(builtIns)).toEqual(['goal', 'usage', 'loop', 'schedule']);
    expect(skills).toEqual([]);
  });
});

describe('leadingCommand', () => {
  it('marks the command a message opens with, and not a slash elsewhere or a path', () => {
    expect(leadingCommand('/ship fix the build')).toBe('/ship');
    expect(leadingCommand('/usage')).toBe('/usage');
    expect(leadingCommand('/goal\nship it')).toBe('/goal');
    expect(leadingCommand('/')).toBeNull();
    expect(leadingCommand('/etc/hosts is wrong')).toBeNull();
    expect(leadingCommand('run /ship')).toBeNull();
  });
});
