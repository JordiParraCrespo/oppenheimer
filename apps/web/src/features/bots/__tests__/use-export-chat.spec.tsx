import { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useExportChat } from '../hooks/use-export-chat';

/**
 * Export hands the browser one Markdown file named after the bot and the
 * day, built from the whole chat the export read returned. What breaks this:
 * a file built from the chat's window instead, or one the browser is never
 * handed.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const state = vi.hoisted(() => ({
  onSuccess: undefined as ((messages: BotMessageEntity[]) => void) | undefined,
  mutate: vi.fn(),
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useExportBotConversation: (options: { onSuccess: (messages: BotMessageEntity[]) => void }) => {
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
  it('reads the whole chat of the bot, then saves it as <bot-name>-chat-<day>.md', async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 15, 10, 0), toFake: ['Date'] });
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:chat';
    });
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('release-bot-chat-2026-10-15.md');
      expect(this.href).toBe('blob:chat');
    });

    const { result } = renderHook(() => useExportChat('bot-1', 'Release Bot'));
    result.current.exportChat();
    expect(state.mutate).toHaveBeenCalledWith('bot-1');

    state.onSuccess?.([
      new BotMessageEntity('m1', 't1', 'user', 'What is staging?', [], new Date()),
    ]);

    expect(click).toHaveBeenCalledOnce();
    expect(created).toHaveLength(1);
    const text = await created[0]?.text();
    expect(text).toContain('# Release Bot');
    expect(text).toContain('What is staging?');
  });
});
