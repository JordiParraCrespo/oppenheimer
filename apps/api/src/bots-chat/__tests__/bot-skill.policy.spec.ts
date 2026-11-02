/**
 * How a person's slash command becomes the turn's message (`25-bots.md`
 * §4.1). What breaks this: `/goal <condition>` read as a skill the bot does
 * not have, so the turn says "no such skill" while the goal it set runs; a
 * bot's old skill named `goal` taking the built-in's place.
 */
import { parseBotSlashCommand } from '@oppenheimer/shared';
import { composeTurnMessage } from '../domain/bot-skill.policy';

const skill = {
  name: 'goal',
  description: 'An old skill saved before the name was reserved',
  body: 'Do the old thing.',
  userInvocable: true,
  modelInvocable: true,
};

describe('composeTurnMessage', () => {
  it('opens a /goal turn with the condition as its directive, never as a skill', () => {
    const message = '/goal pnpm test exits 0';
    const turn = composeTurnMessage(parseBotSlashCommand(message), [skill], message);
    expect(turn).toContain('The person set you a goal with /goal');
    expect(turn).toContain('pnpm test exits 0');
    expect(turn).not.toContain('Do the old thing.');
    expect(turn).not.toContain('not one of your skills');
  });

  it('still runs a skill of the bot’s by its name', () => {
    const message = '/notes v2';
    const turn = composeTurnMessage(
      parseBotSlashCommand(message),
      [{ ...skill, name: 'notes', body: 'Write the notes.' }],
      message,
    );
    expect(turn).toContain('Write the notes.');
  });
});
