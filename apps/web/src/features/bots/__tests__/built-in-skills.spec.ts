import { describe, expect, it } from 'vitest';
import { builtInSkillsBeside } from '../lib/built-in-skills';

/**
 * Which built-in skills Settings → Skills shows beside the bot's own. What
 * breaks this: a bot saying it used the `oppenheimer` skill while the page
 * lists no such skill, or the page showing a built-in that a skill of the
 * bot's own, saved under that name, replaces.
 */
describe('builtInSkillsBeside', () => {
  it('lists every built-in, with its words, when the bot has none of their names', () => {
    const shown = builtInSkillsBeside([{ name: 'triage' }]);
    expect(shown.map((skill) => skill.name)).toEqual(['oppenheimer', 'recap']);
    expect(shown[0]?.body).toContain('read_oppenheimer_docs');
  });

  it('leaves out a built-in whose name a skill of the bot’s own holds', () => {
    expect(builtInSkillsBeside([{ name: 'recap' }]).map((skill) => skill.name)).toEqual([
      'oppenheimer',
    ]);
  });
});
