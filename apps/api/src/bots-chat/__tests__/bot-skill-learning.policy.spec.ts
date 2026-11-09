/**
 * How a bot learns from its own work (`25-bots.md` §4.1, 2026-11-09). What
 * breaks this: the reminder firing on a short turn, twice in one turn, on a
 * turn that already used or saved a skill, or on a call that raised a card;
 * the reminder left in what the chat stores; a patch that replaces the
 * first of several matches, or saves a body over the limit; and a bot
 * rewriting a skill the person wrote without being asked, or a built-in.
 * The wiring is the toolbox's spec, the tool the skill tools' spec.
 */
import { BOT_SKILL_BODY_MAX } from '@oppenheimer/shared';
import {
  BOT_SKILL_NUDGE_AFTER_STEPS,
  BotSkillNudge,
  opensWithSkill,
  patchSkillBody,
  skillPatchAllowed,
  withoutSkillNudge,
  withSkillNudge,
} from '../domain/bot-skill-learning.policy';

/** Reports each call in `tools` as finished; the 1-based indexes whose result carries the reminder. */
function run(nudge: BotSkillNudge, tools: readonly string[], asked = false): number[] {
  return tools.flatMap((tool, i) => (nudge.finished(tool, { asked }) ? [i + 1] : []));
}

const calls = (count: number, tool = 'get_session') => Array.from({ length: count }, () => tool);

describe('BotSkillNudge', () => {
  it('reminds once, on the call that reaches the threshold, and never again that turn', () => {
    expect(run(new BotSkillNudge(false), calls(20))).toEqual([BOT_SKILL_NUDGE_AFTER_STEPS]);
  });

  it('says nothing on a turn shorter than the threshold', () => {
    expect(run(new BotSkillNudge(false), calls(BOT_SKILL_NUDGE_AFTER_STEPS - 1))).toEqual([]);
  });

  it.each(['use_skill', 'save_skill', 'patch_skill'])(
    'says nothing on a turn that called %s',
    (tool) => {
      const tools = [...calls(3), tool, ...calls(10)];
      expect(run(new BotSkillNudge(false), tools)).toEqual([]);
    },
  );

  it('says nothing on a turn that opened with a skill the person ran', () => {
    expect(run(new BotSkillNudge(true), calls(20))).toEqual([]);
  });

  it('skips a call that raised a card, and carries it on the next one', () => {
    const nudge = new BotSkillNudge(false);
    run(nudge, calls(BOT_SKILL_NUDGE_AFTER_STEPS - 1));
    expect(nudge.finished('start_session', { asked: true })).toBe(false);
    expect(nudge.finished('get_session', { asked: false })).toBe(true);
  });
});

describe('opensWithSkill', () => {
  it('reads a /<name> as a skill run, a built-in or no command as none', () => {
    expect(opensWithSkill('release-notes')).toBe(true);
    expect(opensWithSkill('goal')).toBe(false);
    expect(opensWithSkill('schedule')).toBe(false);
    expect(opensWithSkill(null)).toBe(false);
    expect(opensWithSkill(undefined)).toBe(false);
  });
});

describe('the reminder in the chat', () => {
  it('is taken back off the output the chat stores, and only it', () => {
    expect(withoutSkillNudge(withSkillNudge('3 sessions'))).toBe('3 sessions');
    expect(withoutSkillNudge('3 sessions')).toBe('3 sessions');
  });
});

describe('patchSkillBody', () => {
  const body = '1. Read the log.\n2. Run pnpm release.\n3. Post the notes.';

  it('replaces the one passage that matches', () => {
    expect(patchSkillBody(body, 'pnpm release', 'pnpm release:notes')).toEqual({
      ok: true,
      body: '1. Read the log.\n2. Run pnpm release:notes.\n3. Post the notes.',
    });
  });

  it('removes a passage replaced by nothing', () => {
    expect(patchSkillBody(body, '\n3. Post the notes.', '')).toEqual({
      ok: true,
      body: '1. Read the log.\n2. Run pnpm release.',
    });
  });

  it('changes nothing when the passage is not there', () => {
    expect(patchSkillBody(body, 'pnpm publish', 'x')).toEqual({ ok: false, reason: 'absent' });
  });

  it('changes nothing when the passage is there more than once, overlapping included', () => {
    expect(patchSkillBody(body, 'the', 'a')).toEqual({ ok: false, reason: 'ambiguous' });
    expect(patchSkillBody('aaa', 'aa', 'b')).toEqual({ ok: false, reason: 'ambiguous' });
  });

  it('refuses a result that would be empty or over the limit', () => {
    expect(patchSkillBody(body, body, '  ')).toEqual({ ok: false, reason: 'empty' });
    expect(patchSkillBody(body, 'Read', 'x'.repeat(BOT_SKILL_BODY_MAX))).toEqual({
      ok: false,
      reason: 'too_long',
    });
  });
});

describe('skillPatchAllowed', () => {
  it('lets the bot fix a skill it wrote last, unasked', () => {
    expect(skillPatchAllowed({ name: 'triage', source: 'bot', askedByPerson: false })).toBe(
      'allowed',
    );
  });

  it('lets it change one the person wrote only when they asked', () => {
    expect(skillPatchAllowed({ name: 'triage', source: 'user', askedByPerson: false })).toBe(
      'theirs',
    );
    expect(skillPatchAllowed({ name: 'triage', source: 'user', askedByPerson: true })).toBe(
      'allowed',
    );
  });

  it('never lets it change a built-in, asked or not', () => {
    expect(skillPatchAllowed({ name: 'goal', source: 'bot', askedByPerson: true })).toBe(
      'built_in',
    );
  });
});
