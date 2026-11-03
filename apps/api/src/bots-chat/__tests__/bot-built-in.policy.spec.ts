/**
 * A built-in the console runs, refused as a message (`25-bots.md` §4.1,
 * "Built-in commands"). What breaks this: `/usage` or `/goal clear` sent
 * through the API spending a turn that does nothing it asks; `/goal
 * <condition>` or a skill refused along with them; a refusal that does not
 * say where the command's console side is.
 */
import { ArgumentInvalidException } from '@oppenheimer/backend-ddd';
import { refuseConsoleCommand } from '../domain/bot-built-in.policy';

describe('refuseConsoleCommand', () => {
  it('refuses /goal alone, /goal clear and /usage as messages, and lets the rest through', () => {
    for (const content of ['/goal', '/goal stop', '/usage', '/usage today']) {
      expect(() => refuseConsoleCommand(content)).toThrow(ArgumentInvalidException);
    }
    expect(() => refuseConsoleCommand('/usage')).toThrow(/GET \/bots\/:id\/usage/);
    expect(() => refuseConsoleCommand('/goal off')).toThrow(/DELETE \/bots\/:id\/goal/);
    for (const content of ['/goal CI is green', '/usages', 'what is my usage?']) {
      expect(() => refuseConsoleCommand(content)).not.toThrow();
    }
  });
});
