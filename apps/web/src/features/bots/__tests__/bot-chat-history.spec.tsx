import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotChatHistory } from '../sections/bot-chat-history';

/**
 * Profile's chat history row. What breaks this: a placeholder ("No messages
 * yet." with Export and Clear history always off) standing in for a chat
 * that has messages, a count that is the chat's window (the newest hundred)
 * rather than the whole chat, or Export and Clear offered on an empty chat.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}(${values.count},${values.date})` : key,
  }),
}));

const state = vi.hoisted(() => ({
  history: { messageCount: 0, lastMessageAt: null as Date | null, busy: false },
  exportChat: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseBotHistory: () => ({ data: state.history, error: null }),
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  ErrorAlert: () => null,
  formatMediumDate: (date: Date) => date.toISOString().slice(0, 10),
  useLocale: () => 'en',
}));

vi.mock('../hooks/use-export-chat', () => ({
  useExportChat: () => ({
    exportChat: state.exportChat,
    pending: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../dialogs/clear-chat-history', () => ({
  ClearChatHistoryDialog: () => <div role="alertdialog">clear</div>,
}));

afterEach(() => {
  cleanup();
  state.history = { messageCount: 0, lastMessageAt: null, busy: false };
  state.exportChat.mockReset();
});

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('BotChatHistory', () => {
  it('says how many messages the whole chat holds and when the last was written', () => {
    state.history = {
      messageCount: 142,
      lastMessageAt: new Date('2026-10-15T12:00:00Z'),
      busy: false,
    };
    render(<BotChatHistory botId="bot-1" botName="Release Bot" />);

    expect(screen.getByText('bots.settings.profile.messages(142,2026-10-15)')).toBeTruthy();
    expect(button('bots.settings.profile.export').disabled).toBe(false);
    fireEvent.click(button('bots.settings.profile.export'));
    expect(state.exportChat).toHaveBeenCalledOnce();
    fireEvent.click(button('bots.settings.profile.clear'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
  });

  it('says there are no messages, with nothing to export or clear, only when there are none', () => {
    render(<BotChatHistory botId="bot-1" botName="Release Bot" />);

    expect(screen.getByText('bots.settings.profile.noMessages')).toBeTruthy();
    expect(button('bots.settings.profile.export').disabled).toBe(true);
    expect(button('bots.settings.profile.clear').disabled).toBe(true);
  });
});
