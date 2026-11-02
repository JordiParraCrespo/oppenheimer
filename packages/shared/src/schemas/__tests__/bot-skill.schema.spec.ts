import { describe, expect, it } from 'vitest';
import {
  BOT_SKILL_NAME_MAX,
  botSkillNameDraft,
  botSkillNameOf,
  botSkillSchema,
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

  it('refuses a name that could not be typed as a command, or the reserved one', () => {
    for (const name of ['Release', 'release notes', '-release', 'skill', '']) {
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
