import type { InboxItem } from '@oppenheimer/frontend-consumer';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotChatSlotContext } from '../hooks/use-bot-chat-slot';
import { InboxBotNoticeCard } from '../sections/inbox-bot-notice-card';
import { InboxItemMessage } from '../sections/inbox-item-message';

/**
 * A bot's notice is answered on its card: Reply here opens that bot's chat
 * under the notice, and pressing it again folds the chat away. What breaks
 * this: a chat opened for another bot than the one that wrote (matched by
 * anything but the notice's bot id), a chat closed under the person's
 * typing when the bot sends a newer notice (its latest, under a new id), a
 * chat mounted before it is asked for
 * (which would mark the bot read, and fetch, on every card shown), or a
 * Reply offered where no chat was composed in.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: { children?: ReactNode }) => <a {...props}>{children}</a>,
}));

afterEach(cleanup);

const item = {
  kind: 'botNotice',
  key: 'botNotice:b1:n1',
  since: new Date(0),
  projectIds: [],
  low: false,
  notice: { id: 'n1', botId: 'b1' },
} as unknown as Extract<InboxItem, { kind: 'botNotice' }>;

const copy = { sender: 'Adri', title: 'Adri has news for you', body: 'The send failed.' } as never;

function renderCard(chat: ((botId: string) => ReactNode) | null) {
  render(
    <BotChatSlotContext value={chat}>
      <InboxBotNoticeCard item={item} copy={copy} from="Bot" age="3m ago" />
    </BotChatSlotContext>,
  );
}

describe('a bot notice answered in place', () => {
  it("opens the writing bot's chat on Reply here, and folds it again", () => {
    const chat = vi.fn((botId: string) => <p>chat with {botId}</p>);
    renderCard(chat);
    expect(screen.queryByText('chat with b1')).toBeNull();
    expect(chat).not.toHaveBeenCalled();

    const reply = screen.getByRole('button', { name: 'inbox.botNotice.reply' });
    expect(reply.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(reply);
    expect(screen.getByText('chat with b1')).toBeTruthy();
    expect(chat).toHaveBeenCalledWith('b1');

    const hide = screen.getByRole('button', { name: 'inbox.botNotice.hideReply' });
    expect(hide.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(hide);
    expect(screen.queryByText('chat with b1')).toBeNull();
  });

  it('offers only Open chat where no chat was composed in', () => {
    renderCard(null);
    expect(screen.queryByRole('button', { name: 'inbox.botNotice.reply' })).toBeNull();
    expect(screen.getByText('inbox.botNotice.openChat')).toBeTruthy();
  });

  it('stays open when the bot it answers sends a newer notice, and closes for another bot', () => {
    const chat = (botId: string) => <p>chat with {botId}</p>;
    const shown = (notice: { id: string; botId: string }) => (
      <BotChatSlotContext value={chat}>
        <InboxItemMessage
          item={{ ...item, key: `botNotice:${notice.botId}:${notice.id}`, notice } as never}
          copy={copy}
          from="Bot"
          age="now"
        />
      </BotChatSlotContext>
    );
    const { rerender } = render(shown({ id: 'n1', botId: 'b1' }));
    fireEvent.click(screen.getByRole('button', { name: 'inbox.botNotice.reply' }));
    expect(screen.getByText('chat with b1')).toBeTruthy();

    rerender(shown({ id: 'n2', botId: 'b1' }));
    expect(screen.getByText('chat with b1')).toBeTruthy();

    rerender(shown({ id: 'n3', botId: 'b2' }));
    expect(screen.queryByText('chat with b2')).toBeNull();
    expect(screen.getByRole('button', { name: 'inbox.botNotice.reply' })).toBeTruthy();
  });
});
