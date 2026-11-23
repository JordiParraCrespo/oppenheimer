import { describe, expect, it } from 'vitest';
import { WhatsappChatGrantEntity } from '../whatsapp-chat-grant.entity';

/**
 * What Settings → WhatsApp calls an allowed chat: its name, else a person's
 * number as they write it, else the chat's id, so a row is never blank.
 */
function grant(chatId: string, chatKind: 'direct' | 'group', chatName: string | null) {
  return new WhatsappChatGrantEntity(
    'g',
    'a',
    chatId,
    chatKind,
    chatName,
    null,
    null,
    new Date('2026-11-18T09:00:00Z'),
  );
}

describe('WhatsappChatGrantEntity', () => {
  it('is called by its name, else a person’s number, else its id', () => {
    expect(grant('120363000000000001@g.us', 'group', 'Family').title).toBe('Family');
    expect(grant('34611222333@s.whatsapp.net', 'direct', null).title).toBe('+34611222333');
    expect(grant('120363000000000001@g.us', 'group', null).title).toBe('120363000000000001@g.us');
  });
});
