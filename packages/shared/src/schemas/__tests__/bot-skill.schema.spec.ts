import { describe, expect, it } from 'vitest';
import {
  BOT_SKILL_NAME_MAX,
  botGoalCommandOf,
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

describe('isBotConsoleCommand', () => {
  const runsHere = (message: string) => isBotConsoleCommand(parseBotSlashCommand(message));

  it('is the built-ins the console runs: /goal alone, /goal clear, /usage with anything after it', () => {
    for (const message of ['/goal', '/goal off', '/usage', '/usage this week']) {
      expect(runsHere(message)).toBe(true);
    }
  });

  it('leaves /goal <condition>, a skill and a plain message to be sent', () => {
    for (const message of ['/goal CI is green', '/release-notes', 'my usage?']) {
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
    for (const name of ['Release', 'release notes', '-release', 'skill', 'goal', 'usage', '']) {
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
