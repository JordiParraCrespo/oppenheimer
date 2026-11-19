import { describe, expect, it } from 'vitest';
import {
  WHATSAPP_VOICE_NOTE_OPENING,
  whatsappMessageRowIdOf,
  whatsappSourceKey,
  whatsappTurn,
} from '../domain/bot-whatsapp-turn.policy';

/**
 * A message of the owner's on WhatsApp is a turn of its own conversation,
 * once however often it is delivered, keyed by the row it was stored as.
 */

const CONVERSATION = '0b3e2a1c-5555-4c5d-8e6f-70819203b4c5';
const ACCOUNT = '0b3e2a1c-6666-4c5d-8e6f-70819203b4c5';
const ROW = '0b3e2a1c-7777-4c5d-8e6f-70819203b4c5';
const OTHER_CONVERSATION = '0b3e2a1c-8888-4c5d-8e6f-70819203b4c5';
const props = {
  organizationId: 'org',
  botId: 'bot',
  requestedByUserId: 'user',
  provider: 'anthropic' as const,
  model: 'claude',
  effort: null,
};
const message = {
  conversationId: CONVERSATION,
  whatsappAccountId: ACCOUNT,
  messageRowId: ROW,
  text: 'What sold today?',
  voiceNote: false,
};

describe('whatsappTurn', () => {
  // What breaks this: a WhatsApp message landing in the console chat, or a
  // delivery again after a /new or a switch queued as a second turn because
  // the key named the conversation.
  it('queues the message in the chat’s conversation as the owner’s, keyed by the stored row alone', () => {
    const { turn, opening } = whatsappTurn(props, message);
    expect(turn.conversationId).toBe(CONVERSATION);
    expect(turn.inConsole).toBe(false);
    expect(turn.origin).toBe('whatsapp');
    expect(turn.lane).toBe('owner');
    expect(turn.sourceKey).toBe(whatsappSourceKey(message));
    expect(turn.sourceKey).not.toContain(CONVERSATION);
    expect(opening.conversationId).toBe(CONVERSATION);
    expect(opening.role).toBe('user');
    expect(opening.content).toBe('What sold today?');
    expect(opening.pendingMedia).toBeNull();

    const again = whatsappTurn(props, { ...message, conversationId: OTHER_CONVERSATION });
    expect(again.turn.sourceKey).toBe(turn.sourceKey);
  });

  // What breaks this: a voice note's turn asking the bot "[voice note]", or the
  // need to hear it read off the words (a typed "[voice note]" would collide).
  it('opens a voice note’s turn with the note pending and a placeholder for the chat', () => {
    const { opening } = whatsappTurn(props, { ...message, text: '', voiceNote: true });
    expect(opening.content).toBe(WHATSAPP_VOICE_NOTE_OPENING);
    expect(opening.pendingMedia).toEqual({ kind: 'whatsapp_voice_note' });
  });

  // What breaks this: a key built from the chat's JID and WhatsApp's own
  // id, which reach 128 characters each, refused by bot_turn."sourceKey"
  // varchar(128); or the reply unable to find the message it quotes.
  it('keeps the key inside 128 characters and reads the row back from it', () => {
    const key = whatsappSourceKey(message);
    expect(key.length).toBeLessThanOrEqual(128);
    expect(whatsappMessageRowIdOf(key)).toBe(ROW);
  });

  it('reads no row from a key that is not a WhatsApp turn’s', () => {
    expect(whatsappMessageRowIdOf(null)).toBeNull();
    expect(whatsappMessageRowIdOf('telegram:a:1:2')).toBeNull();
    expect(
      whatsappMessageRowIdOf(`whatsapp:${ACCOUNT}:${'3'.repeat(113)}@s.whatsapp.net`),
    ).toBeNull();
  });
});
