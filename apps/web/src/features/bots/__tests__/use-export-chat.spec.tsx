import { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import type { ExportBotConversationVariables } from '@oppenheimer/frontend-consumer/react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExportChat } from '../hooks/use-export-chat';

/**
 * Export asks for the bot's whole chat with the file's header and a piece per
 * message, and hands the browser the file it gets back, named after the bot
 * and the day. What breaks this: a file never handed to the browser, or
 * pieces that are not the chat's Markdown.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  onSuccess: undefined as ((file: Blob) => void) | undefined,
  mutate: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useExportBotConversation: (options: { onSuccess: (file: Blob) => void }) => {
    state.onSuccess = options.onSuccess;
    return { mutate: state.mutate, isPending: false, error: null, reset: vi.fn() };
  },
}));

vi.mock('@oppenheimer/frontend-web', () => ({
  formatDateTime: () => '15 Oct 2026, 10:00',
  useLocale: () => 'en',
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('useExportChat', () => {
  it('asks for the bot’s chat as Markdown pieces, then saves <bot-name>-chat-<day>.md', () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 10, 0), toFake: ['Date'] });
    URL.createObjectURL = vi.fn(() => 'blob:chat');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('release-bot-chat-2026-10-15.md');
      expect(this.href).toBe('blob:chat');
    });

    const { result } = renderHook(() => useExportChat('bot-1', 'Release Bot'));
    result.current.exportChat();
    const asked = state.mutate.mock.calls[0]?.[0] as ExportBotConversationVariables;
    expect(asked.id).toBe('bot-1');
    expect(asked.header).toContain('# Release Bot');
    expect(asked.type).toContain('text/markdown');
    const said = new BotMessageEntity('m1', 't1', 'user', 'What is staging?', [], new Date());
    expect(asked.chunk(said)).toContain('What is staging?');

    const file = new Blob(['# Release Bot']);
    state.onSuccess?.(file);
    expect(click).toHaveBeenCalledOnce();
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  });
});
