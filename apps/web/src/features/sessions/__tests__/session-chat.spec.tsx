import { SessionChat as Chat } from '@oppenheimer/frontend-consumer';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useChatState } from '../hooks/use-session-chat';
import { createFileHandOff } from '../lib/file-hand-off';
import { SessionChat } from '../sections/session-chat';

/**
 * The chat view over a session's terminal: it draws the conversation the
 * host sends, and what the person writes in its composer is typed into the
 * same PTY the grid types into — the text, then Enter — with Stop
 * pressing Escape while the agent works. Nothing else reaches the agent.
 */
// Whether this workspace has dictation; the recorder itself is the kit's to test.
let voiceAvailable = false;
// The host's end of a pasted file: resolves once its path is in the agent's prompt.
const pasteFile = vi.fn<(file: Blob) => Promise<void>>();
vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useVoiceDictation: () => ({ available: voiceAvailable, transcribe: vi.fn() }),
  usePasteSessionFile: () => ({ mutateAsync: pasteFile }),
}));

/** Waits out the pauses before the words and Enter, which only the fake clock can skip. */
const enterDelay = () => act(() => vi.runAllTimers());

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

describe('a batch', () => {
  it('hands an earlier turn back as it was, so only the turn that moved redraws', () => {
    const chat = new Chat();
    const first = [
      entry({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Fix it' } }),
      entry({
        type: 'assistant',
        uuid: 'a1',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Fixed.' }] },
      }),
      entry({ type: 'user', uuid: 'u2', message: { role: 'user', content: 'Ship it' } }),
    ];
    chat.apply({ reset: true, entries: first });
    const { result } = renderHook(() => useChatState(chat));
    const [settled, live] = result.current.turns;

    act(() =>
      chat.apply({
        entries: [
          entry({
            type: 'assistant',
            uuid: 'a2',
            message: { role: 'assistant', content: [{ type: 'text', text: 'Shipped.' }] },
          }),
        ],
      }),
    );

    expect(result.current.turns[0]).toBe(settled);
    expect(result.current.turns[1]).not.toBe(live);
  });
});

describe('files on a message', () => {
  const png = (name: string) => new File(['x'], name, { type: 'image/png' });

  function renderAttaching() {
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    const files = createFileHandOff();
    render(<SessionChat chat={chat} readOnly={false} attach={{ sessionId: 's1', files }} />);
    return { files, typed };
  }

  it('holds what the paperclip picks, then puts the files in the prompt before the words and Enter', async () => {
    pasteFile.mockReset().mockResolvedValue(undefined);
    const { typed } = renderAttaching();
    const picker = screen.getByLabelText('sessions.chat.composer.attach', { selector: 'input' });
    fireEvent.change(picker, { target: { files: [png('a.png'), png('b.png')] } });
    expect(screen.getByText('a.png')).toBeTruthy();
    expect(screen.getByText('b.png')).toBeTruthy();

    vi.useFakeTimers();
    const field = screen.getByPlaceholderText('sessions.chat.composer.placeholder');
    fireEvent.change(field, { target: { value: 'What is in these?' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    await act(async () => {});
    await act(async () => {});
    await act(async () => {});
    // One after another, in the order they were picked, so their paths read in that order.
    expect(pasteFile.mock.calls.map(([file]) => (file as File).name)).toEqual(['a.png', 'b.png']);
    // The words wait for the host to paste the paths ahead of them.
    expect(typed).toEqual([]);
    await enterDelay();
    expect(typed).toEqual(['What is in these?', '\r']);
    expect(screen.queryByText('a.png')).toBeNull();
    vi.useRealTimers();
  });

  it('sends files alone, and takes what the pane hands it from a drop or a paste', async () => {
    pasteFile.mockReset().mockResolvedValue(undefined);
    const { files, typed } = renderAttaching();
    act(() => files.deliver([png('dropped.png')]));
    expect(screen.getByText('dropped.png')).toBeTruthy();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.composer.send' }));
    await act(async () => {});
    await act(async () => {});
    expect(pasteFile).toHaveBeenCalledTimes(1);
    await enterDelay();
    expect(typed).toEqual(['\r']);
    vi.useRealTimers();
  });

  it('keeps the words and the file that did not arrive, says why, and submits nothing', async () => {
    pasteFile.mockReset().mockRejectedValue(new Error('The host is offline'));
    const { files, typed } = renderAttaching();
    act(() => files.deliver([png('trace.png')]));
    const field = screen.getByPlaceholderText('sessions.chat.composer.placeholder');
    fireEvent.change(field, { target: { value: 'Look at this' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('sessions.session.file.failedTitle'),
    );
    expect(screen.getByText('trace.png')).toBeTruthy();
    expect((field as HTMLTextAreaElement).value).toBe('Look at this');
    expect(typed).toEqual([]);
  });

  it('says why a file was turned away rather than dropping it', () => {
    const { files } = renderAttaching();
    act(() => files.deliver([new File(['x'], 'tool.exe', { type: 'application/x-msdownload' })]));
    expect(screen.queryByText('tool.exe')).toBeNull();
    expect(screen.getByText(/sessions\.chat\.composer\.attachNotSupported/)).toBeTruthy();
  });

  it('offers no paperclip to a reader who cannot put files on the host', () => {
    render(<SessionChat chat={new Chat()} readOnly={false} />);
    expect(screen.queryByRole('button', { name: 'sessions.chat.composer.attach' })).toBeNull();
  });
});
