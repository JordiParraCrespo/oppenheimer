import { describe, expect, it } from 'vitest';
import {
  BOT_LOOP_CHECK_IN_PROMPT,
  BOT_SKILL_NAME_MAX,
  botGoalCommandOf,
  botLoopCommandOf,
  botScheduleCommandOf,
  botSkillNameDraft,
  botSkillNameOf,
  botSkillSchema,
  isBotConsoleCommand,
  parseBotSlashCommand,
  updateBotSkillSchema,
} from '../bot-skill.schema.js';

const skill = {
  name: 'release-notes',
  description: 'Writes release notes.',
  body: '1. Read the PRs.',
};

describe('parseBotSlashCommand', () => {
  it('reads a skill and what the person gave it from the start of the message', () => {
    expect(parseBotSlashCommand('/release-notes v2.3 for acme/web')).toEqual({
      name: 'release-notes',
      args: 'v2.3 for acme/web',
    });
  });

  it('runs a skill with nothing after its name, and keeps a multi-line input whole', () => {
    expect(parseBotSlashCommand('  /triage  ')).toEqual({ name: 'triage', args: '' });
    expect(parseBotSlashCommand('/triage first\nsecond')).toEqual({
      name: 'triage',
      args: 'first\nsecond',
    });
  });

  it('takes /skill <name> as the generic entry point, as OpenClaw does', () => {
    expect(parseBotSlashCommand('/skill triage the build')).toEqual({
      name: 'triage',
      args: 'the build',
    });
    expect(parseBotSlashCommand('/skill')).toBeNull();
  });

  it('reads a message that only mentions a path or a slash as written', () => {
    expect(parseBotSlashCommand('look at /etc/hosts')).toBeNull();
    expect(parseBotSlashCommand('/Etc/hosts')).toBeNull();
    expect(parseBotSlashCommand('/usr/bin')).toBeNull();
    expect(parseBotSlashCommand('/')).toBeNull();
    expect(parseBotSlashCommand(`/${'a'.repeat(BOT_SKILL_NAME_MAX + 1)}`)).toBeNull();
  });
});

describe('botGoalCommandOf', () => {
  const goal = (message: string) => botGoalCommandOf(parseBotSlashCommand(message));

  it('reads a condition after /goal as a new goal, whole, over several lines', () => {
    expect(goal('/goal all tests in test/auth pass\nand lint is clean')).toEqual({
      kind: 'set',
      condition: 'all tests in test/auth pass\nand lint is clean',
    });
  });

  it('shows the goal for /goal alone, and clears it for any of the clear words', () => {
    expect(goal('/goal')).toEqual({ kind: 'show' });
    for (const word of ['clear', 'stop', 'off', 'reset', 'none', 'cancel', 'Clear']) {
      expect(goal(`/goal ${word}`)).toEqual({ kind: 'clear' });
    }
  });

  it('leaves a skill command, and a message that is no command, to the skills', () => {
    expect(goal('/goals today')).toBeNull();
    expect(goal('what is my goal')).toBeNull();
  });
});

/**
 * `/loop` (`25-bots.md` §4.1). What breaks this: an interval read as words of
 * the prompt (or the reverse), a part minute rounded down to no interval, an
 * out-of-range interval set as a loop, or `/loop stop` sent as a loop that
 * runs "stop".
 */
describe('botLoopCommandOf', () => {
  const loop = (message: string) => botLoopCommandOf(parseBotSlashCommand(message));

  it('takes the interval before the prompt or after "every", in any unit, a part minute rounded up', () => {
    expect(loop('/loop 5m check the deploy')).toEqual({
      kind: 'set',
      intervalMinutes: 5,
      prompt: 'check the deploy',
    });
    expect(loop('/loop check the deploy every 2 hours')).toEqual({
      kind: 'set',
      intervalMinutes: 120,
      prompt: 'check the deploy',
    });
    expect(loop('/loop 30s ping')).toMatchObject({ intervalMinutes: 1 });
    expect(loop('/loop 1d digest')).toMatchObject({ intervalMinutes: 1_440 });
  });

  it('is self-paced with no interval, and runs the check-in prompt with no prompt', () => {
    expect(loop('/loop watch PR 42')).toEqual({
      kind: 'set',
      intervalMinutes: null,
      prompt: 'watch PR 42',
    });
    expect(loop('/loop')).toEqual({
      kind: 'set',
      intervalMinutes: null,
      prompt: BOT_LOOP_CHECK_IN_PROMPT,
    });
    expect(loop('/loop 10m')).toEqual({
      kind: 'set',
      intervalMinutes: 10,
      prompt: BOT_LOOP_CHECK_IN_PROMPT,
    });
  });

  it('refuses an interval under a minute or over a day, and stops on a clear word', () => {
    expect(loop('/loop 0m x')).toEqual({ kind: 'invalid' });
    expect(loop('/loop 25h x')).toEqual({ kind: 'invalid' });
    expect(loop('/loop Stop')).toEqual({ kind: 'clear' });
    expect(loop('/goal x')).toBeNull();
  });
});

/**
 * `/schedule` (`25-bots.md` §4.1). What breaks this: a bare `/schedule`
 * sent to the bot, spending a turn on nothing, or a request's words lost.
 */
describe('botScheduleCommandOf', () => {
  const schedule = (message: string) => botScheduleCommandOf(parseBotSlashCommand(message));

  it('reads the request as written, and opens the routines with nothing after it', () => {
    expect(schedule('/schedule every weekday at 9, check open PRs')).toEqual({
      kind: 'set',
      request: 'every weekday at 9, check open PRs',
    });
    expect(schedule('/schedule')).toEqual({ kind: 'open' });
    expect(schedule('/loop 5m x')).toBeNull();
  });
});

describe('isBotConsoleCommand', () => {
  const runsHere = (message: string) => isBotConsoleCommand(parseBotSlashCommand(message));

  it('is the built-ins the console runs: /goal alone, /goal clear, /usage with anything after it', () => {
    for (const message of [
      '/goal',
      '/goal off',
      '/usage',
      '/usage this week',
      '/loop stop',
      '/schedule',
    ]) {
      expect(runsHere(message)).toBe(true);
    }
  });

  it('leaves /goal <condition>, a skill and a plain message to be sent', () => {
    for (const message of [
      '/goal CI is green',
      '/loop 5m check CI',
      '/loop',
      '/schedule every weekday at 9 check open PRs',
      '/release-notes',
      'my usage?',
    ]) {
      expect(runsHere(message)).toBe(false);
    }
  });
});

describe('botSkillNameOf', () => {
  it('turns a typed title into a command name', () => {
    expect(botSkillNameOf('Release Notes!')).toBe('release-notes');
    expect(botSkillNameOf('  --PR review__flow ')).toBe('pr-review-flow');
    expect(botSkillNameOf('***')).toBe('');
    expect(botSkillNameOf('x'.repeat(40))).toHaveLength(BOT_SKILL_NAME_MAX);
  });

  it('keeps a hyphen at the end while the name is typed, so the next word can follow', () => {
    expect(botSkillNameDraft('Release ')).toBe('release-');
    expect(botSkillNameDraft('release-n')).toBe('release-n');
    expect(botSkillNameDraft('  -x')).toBe('x');
  });
});

describe('botSkillSchema', () => {
  it('accepts a skill, leaving who may invoke it to the defaults', () => {
    expect(botSkillSchema.parse(skill)).toEqual(skill);
  });

  it('refuses a name that could not be typed as a command, or a reserved one', () => {
    for (const name of [
      'Release',
      'release notes',
      '-release',
      'skill',
      'goal',
      'usage',
      'loop',
      'schedule',
      '',
    ]) {
      expect(botSkillSchema.safeParse({ ...skill, name }).success).toBe(false);
    }
  });

  it('needs a description and a body', () => {
    expect(botSkillSchema.safeParse({ ...skill, description: ' ' }).success).toBe(false);
    expect(botSkillSchema.safeParse({ ...skill, body: '' }).success).toBe(false);
  });

  it('takes a change of any one part, and refuses an empty change', () => {
    expect(updateBotSkillSchema.safeParse({ userInvocable: false }).success).toBe(true);
    expect(updateBotSkillSchema.safeParse({}).success).toBe(false);
  });
});
