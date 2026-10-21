import { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionChat } from '../sections/session-chat';

/**
 * The chat view over a session's terminal: it draws the conversation the
 * host sends, and what the person writes in its composer is typed into the
 * same PTY the grid types into — the text, then Enter — with Stop
 * pressing Escape while the agent works. Nothing else reaches the agent.
 */
// Whether this workspace has dictation; the recorder itself is the kit's to test.
let voiceAvailable = false;
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useVoiceDictation: () => ({ available: voiceAvailable, transcribe: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      args ? `${key}${JSON.stringify(args)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as typeof ResizeObserver;
  // jsdom lays nothing out, so it has no element scrolling to stub around.
  Element.prototype.scrollTo ??= () => {};
});

afterEach(cleanup);

const entry = (value: unknown) => JSON.stringify(value);

describe('SessionChat', () => {
  it('draws what the host sends, and types the composer into the terminal', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const send = vi.fn();
    chat.connect(send);
    render(<SessionChat chat={chat} readOnly={false} />);
    expect(screen.getByText('sessions.chat.empty.title')).toBeTruthy();

    act(() =>
      chat.apply({
        reset: true,
        entries: [
          entry({
            type: 'user',
            uuid: 'u',
            message: { role: 'user', content: 'Fix the flaky test' },
          }),
          entry({
            type: 'assistant',
            uuid: 'a',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Fixed **it**.' }] },
          }),
        ],
      }),
    );
    expect(screen.getByText('Fix the flaky test')).toBeTruthy();
    expect(screen.getByText('it')).toBeTruthy();

    const field = screen.getByPlaceholderText('sessions.chat.composer.placeholder');
    fireEvent.change(field, { target: { value: 'Now ship it' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(send).toHaveBeenCalledWith('Now ship it');
    vi.runAllTimers();
    expect(send).toHaveBeenLastCalledWith('\r');

    // Several lines go as one paste, so their newlines are not Enter.
    fireEvent.change(field, { target: { value: 'One\nTwo' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(send).toHaveBeenCalledWith('\u001b[200~One\nTwo\u001b[201~');
    vi.useRealTimers();
  });

  it('turns send into Stop while the agent works, and Stop presses Escape', () => {
    const chat = new Chat();
    const send = vi.fn();
    chat.apply({
      reset: true,
      entries: [entry({ type: 'user', uuid: 'u', message: { role: 'user', content: 'Go' } })],
    });
    chat.connect(send);
    render(<SessionChat chat={chat} readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.composer.stop' }));
    expect(send).toHaveBeenCalledWith('\u001b');
  });

  it('offers no composer to a watcher', () => {
    render(<SessionChat chat={new Chat()} readOnly />);
    expect(screen.queryByPlaceholderText('sessions.chat.composer.placeholder')).toBeNull();
  });
});

describe('a settled turn', () => {
  it('ends on the files it changed, and folds to its words once the next prompt passes it', () => {
    const chat = new Chat();
    const turn = [
      entry({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Fix it' } }),
      entry({
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-10-21T09:00:00.000Z',
        message: {
          role: 'assistant',
          content: [{ type: 'thinking', thinking: 'Look first.' }],
        },
      }),
      entry({
        type: 'assistant',
        uuid: 'a2',
        timestamp: '2026-10-21T09:00:04.000Z',
        message: {
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'e',
              name: 'Edit',
              input: { file_path: 'src/a.ts', old_string: 'a', new_string: 'a\nb' },
            },
          ],
        },
      }),
      entry({
        type: 'user',
        uuid: 'r',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 'e', content: 'ok' }],
        },
      }),
      entry({
        type: 'assistant',
        uuid: 'a3',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
      }),
    ];
    chat.apply({ reset: true, entries: turn });
    render(<SessionChat chat={chat} readOnly />);
    expect(screen.getByText('sessions.chat.changes{"count":1}')).toBeTruthy();
    expect(screen.getByText('sessions.chat.thoughtFor{"seconds":4}')).toBeTruthy();

    act(() =>
      chat.apply({
        entries: [entry({ type: 'user', uuid: 'u2', message: { role: 'user', content: 'Next' } })],
      }),
    );
    // The older turn keeps its words and its card; its thinking folds away.
    expect(screen.getByText('Done.')).toBeTruthy();
    expect(screen.getByText('sessions.chat.changes{"count":1}')).toBeTruthy();
    expect(screen.queryByText('sessions.chat.thoughtFor{"seconds":4}')).toBeNull();
  });
});

describe('dictation', () => {
  it('offers the mic beside send only where the workspace can hear', () => {
    voiceAvailable = false;
    const { unmount } = render(<SessionChat chat={new Chat()} readOnly={false} />);
    expect(screen.queryByRole('button', { name: 'common.dictation.dictate' })).toBeNull();
    unmount();

    voiceAvailable = true;
    render(<SessionChat chat={new Chat()} readOnly={false} />);
    expect(screen.getByRole('button', { name: 'common.dictation.dictate' })).toBeTruthy();
  });
});
