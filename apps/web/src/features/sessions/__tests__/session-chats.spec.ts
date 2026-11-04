// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { sessionChatFor } from '../lib/session-chats';

/**
 * A session's chat outlives its pane, so moving away from a session and
 * back draws the conversation the tab already read instead of waiting on
 * the host's history again. Breaks if the pane makes a new chat per mount,
 * or the kept chats grow without bound.
 */
describe('the chats a tab keeps', () => {
  it('hands a session its own chat again when its pane mounts again', () => {
    const chat = sessionChatFor('session-a');
    chat.apply({
      reset: true,
      history: 'end',
      entries: [
        JSON.stringify({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Hi' } }),
      ],
    });
    sessionChatFor('session-b');

    expect(sessionChatFor('session-a')).toBe(chat);
    expect(sessionChatFor('session-a').snapshot().turns).toHaveLength(1);
    expect(sessionChatFor('session-b')).not.toBe(chat);
  });

  it('lets the least recently read go past five', () => {
    const first = sessionChatFor('kept-1');
    const second = sessionChatFor('kept-2');
    for (const key of ['kept-3', 'kept-4', 'kept-5']) sessionChatFor(key);
    // Read again, so it is the newest and stays; the second is now the oldest.
    expect(sessionChatFor('kept-1')).toBe(first);
    sessionChatFor('kept-6');

    expect(sessionChatFor('kept-1')).toBe(first);
    expect(sessionChatFor('kept-2')).not.toBe(second);
  });
});
