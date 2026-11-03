import { BotLoopEntity } from '../domain/bot-loop.entity';
import { loopSourceKey } from '../domain/bot-loop.policy';
import { loopEndLine, loopRunTurn, loopSetPrompt } from '../domain/bot-loop-message.factory';

/**
 * What a loop says (`25-bots.md` §4.1, `/loop`). What breaks this: a run
 * queued in the person's lane or under a key the loop cannot find again; the
 * line numbering runs from the first queued run rather than the message that
 * set the loop; a self-paced loop's bot never told that a run which does not
 * call schedule_loop ends it.
 */

const SET_AT = new Date('2026-11-03T09:00:00Z');

function loop(intervalMinutes: number | null): BotLoopEntity {
  return BotLoopEntity.set(
    {
      organizationId: 'org-1',
      botId: 'bot-1',
      originTurnId: 'turn-0',
      prompt: 'check the deploy',
      intervalMinutes,
      credentialScopes: null,
      timeZone: null,
    },
    SET_AT,
  );
}

describe('loopRunTurn', () => {
  it('queues a run in the background lane, keyed by the loop and its count, opened by its line', () => {
    const fixed = loop(5);
    const { turn, opening } = loopRunTurn(
      {
        organizationId: 'org-1',
        botId: 'bot-1',
        requestedByUserId: 'user-1',
        provider: 'glm',
        model: 'glm-5.3',
        effort: null,
      },
      fixed,
      1,
    );
    expect(turn).toMatchObject({
      origin: 'loop',
      lane: 'background',
      sourceKey: loopSourceKey(fixed.id, 1),
    });
    // The setting turn was the first run, so the first one queued is the second.
    expect(opening.event).toMatchObject({ kind: 'loop', activity: 'ran', run: 2 });
    expect(opening.content).toContain('Run 2 of your loop');
  });
});

describe('what the bot is told', () => {
  it('tells a self-paced loop to say when it runs next, and a fixed one its interval', () => {
    expect(loopSetPrompt(null, 'watch PR 42')).toContain('call schedule_loop');
    expect(loopSetPrompt(120, 'digest')).toContain('every 2 hours');
    expect(loopSetPrompt(120, 'digest')).not.toContain('schedule_loop');
  });

  it('says how a loop ended, outside any turn, counting the setting turn as a run', () => {
    const line = loopEndLine(loop(5), 'expired', null);
    expect(line.turnId).toBeNull();
    expect(line.event).toMatchObject({ kind: 'loop', activity: 'expired', run: 1 });
  });
});
