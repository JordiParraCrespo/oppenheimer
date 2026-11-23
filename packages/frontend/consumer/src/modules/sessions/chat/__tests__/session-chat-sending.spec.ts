import { describe, expect, it } from 'vitest';
import { matchSent, SentMessages } from '../session-chat-sending';

/**
 * Which sent messages the transcript's prompts have replaced: the rule the
 * chat's "sending" cards go by, apart from the chat that draws them.
 */

const turn = (id: string, text: string | null) => ({
  id,
  prompt: text === null ? null : { id: `p-${id}`, text },
});

describe('matchSent', () => {
  // `!ls` comes back as `! ls`: matched as typed, its card stayed under its turn.
  it('knows a message in its prompt however the transcript spaces it', () => {
    const { left } = matchSent(
      [{ id: 's1', text: '!ls' }],
      () => null,
      [turn('t1', '! ls')],
      new Set(),
    );
    expect(left).toEqual([]);
  });

  it('looks only past the turn that was last when the message went', () => {
    const { left } = matchSent(
      [{ id: 's1', text: 'continue' }],
      () => 't1',
      [turn('t1', 'continue'), turn('t2', 'something else')],
      new Set(),
    );
    expect(left.map((held) => held.id)).toEqual(['s1']);
  });

  it('gives each prompt to one message, the oldest, and none it was given before', () => {
    const sending = [
      { id: 's1', text: 'continue' },
      { id: 's2', text: 'continue' },
    ];
    const first = matchSent(sending, () => null, [turn('t1', 'continue')], new Set());
    expect(first.left.map((held) => held.id)).toEqual(['s2']);
    expect([...first.taken]).toEqual([['s1', 'p-t1']]);

    const again = matchSent(first.left, () => null, [turn('t1', 'continue')], new Set(['p-t1']));
    expect(again.left.map((held) => held.id)).toEqual(['s2']);
  });
});

describe('SentMessages', () => {
  // The prompts matched were forgotten between batches: the first prompt was
  // matched again on the next line, and took the second card early.
  it('keeps a second identical message on its way until its own prompt comes', () => {
    const sent = new SentMessages(() => {});
    const sending = [sent.start('continue', null), sent.start('continue', null)];
    const one = [turn('t1', 'continue')];
    const afterFirst = sent.landed(sending, one);
    expect(afterFirst).toHaveLength(1);
    expect(sent.landed(afterFirst, [...one, turn('t1b', null)])).toBe(afterFirst);
    expect(sent.landed(afterFirst, [...one, turn('t2', 'continue')])).toEqual([]);
    sent.drop();
  });
});
