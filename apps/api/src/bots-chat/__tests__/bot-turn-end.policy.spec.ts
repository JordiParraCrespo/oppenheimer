import { turnEndDeliveries } from '../domain/bot-turn-end.policy';

/**
 * What a turn's end owes beyond itself, from the turn alone: an answer back
 * to the channel chat, the GitHub thread, or the bot that asked. That each is
 * staged as its job in the transaction that ends the turn is the turn
 * repository's integration spec.
 */
describe('turnEndDeliveries', () => {
  const turn = { origin: 'message' as const, replyRequested: false, askedByTurnId: null };

  // Breaks if a channel or GitHub ask goes unanswered where it was made, or a
  // console turn sends an answer anywhere.
  it('owes a channel turn its reply, a GitHub ask its comment, and a console turn nothing', () => {
    expect(turnEndDeliveries(turn)).toEqual([]);
    expect(turnEndDeliveries({ ...turn, origin: 'telegram' })).toEqual(['channel_reply']);
    expect(turnEndDeliveries({ ...turn, origin: 'whatsapp' })).toEqual(['channel_reply']);
    expect(turnEndDeliveries({ ...turn, origin: 'github' })).toEqual(['github_answer']);
  });

  // Breaks if an asked bot's answer is lost, or one nobody waits on is sent.
  it('owes the asking bot its answer only when one was asked for, on top of a channel reply', () => {
    expect(turnEndDeliveries({ ...turn, replyRequested: true, askedByTurnId: 't1' })).toEqual([
      'bot_answer',
    ]);
    expect(turnEndDeliveries({ ...turn, replyRequested: true })).toEqual([]);
    expect(
      turnEndDeliveries({ ...turn, origin: 'telegram', replyRequested: true, askedByTurnId: 't1' }),
    ).toEqual(['channel_reply', 'bot_answer']);
  });
});
