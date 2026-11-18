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
const enterDelay = () => act(() => vi.runAllTimersAsync());

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
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
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

    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );
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
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.composer.stop' }));
    expect(send).toHaveBeenCalledWith('\u001b');
  });

  it('keeps sending while the agent works when its source cannot stop the turn (a cloud session)', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const send = vi.fn();
    chat.apply({
      reset: true,
      entries: [entry({ type: 'user', uuid: 'u', message: { role: 'user', content: 'Go' } })],
    });
    chat.connect(send, undefined, { interruptible: false });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    // Breaks if Stop is offered where nothing can stop the turn: a reply
    // typed mid-turn would be sent as Escape and lost.
    expect(screen.queryByRole('button', { name: 'sessions.chat.composer.stop' })).toBeNull();
    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );
    fireEvent.change(field, { target: { value: 'And tag it' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(send).toHaveBeenCalledWith('And tag it');
    vi.useRealTimers();
  });

  it('offers no composer to a watcher', () => {
    render(<SessionChat chat={new Chat()} agent="claude-code" readOnly />);
    expect(
      screen.queryByPlaceholderText('sessions.chat.composer.placeholder{"agent":"Claude Code"}'),
    ).toBeNull();
  });
});

describe('a settled turn', () => {
  it('ends on the files it changed, folded to its answer once it settles', () => {
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
    render(<SessionChat chat={chat} agent="claude-code" readOnly />);
    // The settled turn keeps its answer and its card; its thinking folds away.
    expect(screen.getByText('Done.')).toBeTruthy();
    // One file is its row alone, no "1 file changed" head over it.
    expect(document.querySelector('[data-slot="changed-file-row"]')).toBeTruthy();
    expect(screen.queryByText('sessions.chat.changes{"count":1}')).toBeNull();
    expect(screen.queryByText('sessions.chat.thoughtFor{"seconds":4}')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /sessions\.chat\.turn\.worked/ }));
    expect(screen.getByText('sessions.chat.thoughtFor{"seconds":4}')).toBeTruthy();
  });

  // Regression: a folded turn kept only the last text block of its answer,
  // dropping the explanation before a command the same message ended on.
  it('keeps every block of its answer when it folds, and folds the words before its work', () => {
    const chat = new Chat();
    chat.apply({
      reset: true,
      entries: [
        entry({ type: 'user', uuid: 'u1', message: { role: 'user', content: 'Count them' } }),
        entry({
          type: 'assistant',
          uuid: 'a1',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me count.' },
              { type: 'tool_use', id: 't', name: 'Bash', input: { command: 'ls | wc -l' } },
            ],
          },
        }),
        entry({
          type: 'user',
          uuid: 'r',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 't', content: '3' }],
          },
        }),
        entry({
          type: 'assistant',
          uuid: 'a2',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'There are three.' },
              { type: 'text', text: 'Recount with ls.' },
            ],
          },
        }),
      ],
    });
    render(<SessionChat chat={chat} agent="claude-code" readOnly />);
    expect(screen.getByText('There are three.')).toBeTruthy();
    expect(screen.getByText('Recount with ls.')).toBeTruthy();
    expect(screen.queryByText('Let me count.')).toBeNull();
  });
});

describe('a command the CLI answers itself', () => {
  // Regression: `/context` drew its prompt and nothing under it.
  it('draws what it printed under its prompt, spacing kept and colours gone', () => {
    const chat = new Chat();
    render(<SessionChat chat={chat} agent="claude-code" readOnly />);
    act(() =>
      chat.apply({
        reset: true,
        entries: [
          entry({
            type: 'user',
            uuid: 'c',
            message: {
              role: 'user',
              content: '<command-name>/context</command-name>\n<command-args></command-args>',
            },
          }),
          entry({
            type: 'user',
            uuid: 'o',
            message: {
              role: 'user',
              content:
                '<local-command-stdout>\u001b[1mContext Usage\u001b[22m\n⛁ ⛀   \u001b[2mOpus 5.5\u001b[22m</local-command-stdout>',
            },
          }),
        ],
      }),
    );
    expect(screen.getByText('/context')).toBeTruthy();
    const output = screen.getByText(/Context Usage/);
    expect(output.textContent).toBe('Context Usage\n⛁ ⛀   Opus 5.5');
    expect(output.closest('pre')).toBeTruthy();

    // It is the command's whole answer: the turn keeps it once the next prompt folds it.
    act(() =>
      chat.apply({
        entries: [entry({ type: 'user', uuid: 'u2', message: { role: 'user', content: 'Next' } })],
      }),
    );
    expect(screen.getByText(/Context Usage/)).toBeTruthy();
  });
});

describe('dictation', () => {
  it('offers the mic beside send only where the workspace can hear', () => {
    voiceAvailable = false;
    const { unmount } = render(
      <SessionChat chat={new Chat()} agent="claude-code" readOnly={false} />,
    );
    expect(screen.queryByRole('button', { name: 'common.dictation.dictate' })).toBeNull();
    unmount();

    voiceAvailable = true;
    render(<SessionChat chat={new Chat()} agent="claude-code" readOnly={false} />);
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
    render(
      <SessionChat
        chat={chat}
        agent="claude-code"
        readOnly={false}
        attach={{ sessionId: 's1', files }}
      />,
    );
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
    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );
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
    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );
    fireEvent.change(field, { target: { value: 'Look at this' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('sessions.session.file.failedTitle'),
    );
    expect(screen.getByText('trace.png')).toBeTruthy();
    expect((field as HTMLTextAreaElement).value).toBe('Look at this');
    expect(typed).toEqual([]);
  });

  it('keeps what was written while the files uploaded, which the message did not carry', async () => {
    let arrive: () => void = () => {};
    pasteFile.mockReset().mockReturnValue(
      new Promise<void>((resolve) => {
        arrive = resolve;
      }),
    );
    const { files, typed } = renderAttaching();
    act(() => files.deliver([png('trace.png')]));
    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );
    fireEvent.change(field, { target: { value: 'Look at this' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'Look at this, and the log' } });

    vi.useFakeTimers();
    await act(async () => arrive());
    await act(async () => vi.runAllTimersAsync());
    expect(typed).toEqual(['Look at this', '\r']);
    expect((field as HTMLTextAreaElement).value).toBe('Look at this, and the log');
    expect(screen.queryByText('trace.png')).toBeNull();
    vi.useRealTimers();
  });

  it('says why a file was turned away rather than dropping it', () => {
    const { files } = renderAttaching();
    act(() => files.deliver([new File(['x'], 'tool.exe', { type: 'application/x-msdownload' })]));
    expect(screen.queryByText('tool.exe')).toBeNull();
    expect(screen.getByText(/sessions\.chat\.composer\.attachNotSupported/)).toBeTruthy();
  });

  it('offers no paperclip to a reader who cannot put files on the host', () => {
    render(<SessionChat chat={new Chat()} agent="claude-code" readOnly={false} />);
    expect(screen.queryByRole('button', { name: 'sessions.chat.composer.attach' })).toBeNull();
  });
});

describe('questions the agent asks', () => {
  const ask = entry({
    type: 'assistant',
    uuid: 'a1',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'q1',
          name: 'AskUserQuestion',
          input: {
            questions: [
              {
                header: 'Scope',
                question: 'What should it cover?',
                multiSelect: false,
                options: [{ label: 'Tokens' }, { label: 'Components' }],
              },
              {
                header: 'Platforms',
                question: 'Which platforms?',
                multiSelect: true,
                options: [{ label: 'Web' }, { label: 'iOS' }, { label: 'Android' }],
              },
            ],
          },
        },
      ],
    },
  });
  const prompt = entry({
    type: 'user',
    uuid: 'u1',
    message: { role: 'user', content: 'Set it up' },
  });
  const result = (content: string, isError = false) =>
    entry({
      type: 'user',
      uuid: 'r1',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'q1', content, is_error: isError }],
      },
    });

  it('takes the composer’s place and sends the picker the keys for every answer at once', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, ask] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    // The picker holds the terminal's input: a message typed now would land in it.
    expect(
      screen
        .getByPlaceholderText('sessions.chat.composer.placeholder{"agent":"Claude Code"}')
        .closest('[hidden]'),
    ).not.toBeNull();
    expect(screen.getByText('What should it cover?')).toBeTruthy();

    // Picking the one choice moves on; the several toggle.
    fireEvent.click(screen.getByRole('button', { name: /Components/ }));
    expect(screen.getByText('Which platforms?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Web/ }));
    fireEvent.click(screen.getByRole('button', { name: /Android/ }));
    fireEvent.click(screen.getByRole('button', { name: /iOS/ }));
    fireEvent.click(screen.getByRole('button', { name: /iOS/ }));
    expect(typed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.question.submit' }));
    act(() => vi.runAllTimers());
    const down = '\u001b[B';
    expect(typed).toEqual(['2', '1', '3', down, down, down, down, '\r', '1']);
    vi.useRealTimers();
  });

  it('waits for an answer to every question before Submit, and Dismiss is Escape', () => {
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, ask] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    fireEvent.change(screen.getByLabelText('common.chat.question.ownAnswerLabel'), {
      target: { value: 'Only icons' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.question.next' }));
    const submit = screen.getByRole('button', { name: 'common.chat.question.submit' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.question.dismiss' }));
    expect(typed).toEqual(['\u001b']);
  });

  it('keeps what was answered, says when they were dismissed, and gives the composer back', () => {
    const chat = new Chat();
    chat.apply({
      reset: true,
      entries: [
        prompt,
        ask,
        result(
          'Your questions have been answered: "What should it cover?"="Components", "Which platforms?"="Web, Linux". You can now continue with these answers in mind.',
        ),
      ],
    });
    const { unmount } = render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    expect(screen.getByText('Components')).toBeTruthy();
    expect(screen.getByText('Web, Linux')).toBeTruthy();
    expect(
      screen
        .getByPlaceholderText('sessions.chat.composer.placeholder{"agent":"Claude Code"}')
        .closest('[hidden]'),
    ).toBeNull();
    unmount();

    const declined = new Chat();
    declined.apply({
      reset: true,
      entries: [prompt, ask, result("The user doesn't want to proceed with this tool use.", true)],
    });
    render(<SessionChat chat={declined} agent="claude-code" readOnly={false} />);
    expect(screen.getByText('sessions.chat.question.dismissed')).toBeTruthy();
  });

  const lone = entry({
    type: 'assistant',
    uuid: 'a2',
    message: {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'q2',
          name: 'AskUserQuestion',
          input: {
            questions: [
              {
                header: 'Scope',
                question: 'What should it cover?',
                multiSelect: false,
                options: [{ label: 'Tokens' }, { label: 'Components' }],
              },
            ],
          },
        },
      ],
    },
  });

  it('answers a lone question with one pick, by its number from where focus lands', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, lone] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    expect(screen.getByText('Scope')).toBeTruthy();
    // Focus is on the first option, so the number keys answer without a click.
    const first = screen.getByRole('button', { name: /Tokens/ });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: '2' });
    act(() => vi.runAllTimers());
    // The picker sends a lone one-choice question on the pick: no review to confirm.
    expect(typed).toEqual(['2']);
    expect(screen.getAllByText('common.chat.question.sending').length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('moves on with Enter from an answer in the person’s own words', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, lone] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    const own = screen.getByLabelText('common.chat.question.ownAnswerLabel');
    fireEvent.keyDown(own, { key: 'Enter' });
    expect(typed).toEqual([]);
    fireEvent.change(own, { target: { value: 'Only icons' } });
    fireEvent.keyDown(own, { key: 'Enter' });
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['3', 'Only icons', '\r']);
    vi.useRealTimers();
  });

  it('keeps the answers to send again when nothing is there to type them', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: [prompt, lone] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Components/ }));
    expect(screen.queryByText('common.chat.question.sending')).toBeNull();
    const submit = screen.getByRole('button', { name: 'common.chat.question.submit' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a watcher that the agent is waiting, with nothing to answer it with', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: [prompt, ask] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly />);
    expect(screen.getByText('sessions.chat.question.waiting')).toBeTruthy();
    expect(screen.queryByText('What should it cover?')).toBeNull();
  });
});

describe('a long conversation', () => {
  const turn = (n: number) => [
    entry({ type: 'user', uuid: `u${n}`, message: { role: 'user', content: `Prompt ${n}` } }),
    entry({
      type: 'assistant',
      uuid: `a${n}`,
      message: { role: 'assistant', content: [{ type: 'text', text: `Reply ${n}` }] },
    }),
  ];

  /**
   * The browser's observer, which jsdom lacks: `reach` puts the elements it
   * watches in view, as a reader scrolling to the chat's top does.
   */
  function observeIntersections() {
    const watched = new Map<Element, IntersectionObserverCallback>();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(private readonly callback: IntersectionObserverCallback) {}
        observe(element: Element) {
          watched.set(element, this.callback);
        }
        disconnect() {
          for (const [element, callback] of watched) {
            if (callback === this.callback) watched.delete(element);
          }
        }
      },
    );
    return {
      reach(element: Element) {
        const callback = watched.get(element);
        if (!callback) throw new Error('the element is not watched');
        act(() =>
          callback(
            [{ isIntersecting: true, target: element } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          ),
        );
      },
    };
  }

  it('draws its latest turns, and the earlier ones a page at a time as the reader scrolls to its top', () => {
    vi.useFakeTimers();
    const observer = observeIntersections();
    const chat = new Chat();
    chat.apply({ reset: true, entries: Array.from({ length: 90 }, (_, i) => turn(i + 1)).flat() });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    expect(screen.getByText('Prompt 90')).toBeTruthy();
    expect(screen.getByText('Prompt 51')).toBeTruthy();
    expect(screen.queryByText('Prompt 50')).toBeNull();

    // The top in view shows the spinner a moment, seen twice or once, and
    // then the page above it.
    const top = screen.getByRole('status', { name: 'sessions.chat.earlier' });
    observer.reach(top);
    observer.reach(top);
    expect(screen.queryByText('Prompt 50')).toBeNull();
    act(() => vi.runAllTimers());
    expect(screen.getByText('Prompt 11')).toBeTruthy();
    expect(screen.queryByText('Prompt 10')).toBeNull();

    observer.reach(screen.getByRole('status', { name: 'sessions.chat.earlier' }));
    act(() => vi.runAllTimers());
    expect(screen.getByText('Prompt 1')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'sessions.chat.earlier' })).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    // Ninety turns drawn and two more pages: 2.6s alone, past vitest's 5s
    // default when the whole repository's suites run side by side.
  }, 15_000);

  it('asks the host for the turns before its tail at the top, and draws them when they come', () => {
    // What breaks this: a chat that holds only the conversation's tail
    // showing nothing above it, or the page that comes drawn after a second
    // wait at the top, or moving what the reader is on as it lands.
    vi.useFakeTimers();
    const observer = observeIntersections();
    const chat = new Chat();
    const asked: number[] = [];
    chat.connect(
      () => {},
      (before) => asked.push(before),
    );
    const tail = Array.from({ length: 40 }, (_, i) => turn(i + 51)).flat();
    chat.apply({ reset: true, history: 'end', before: 4096, entries: tail });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    expect(screen.getByText('Prompt 51')).toBeTruthy();

    observer.reach(screen.getByRole('status', { name: 'sessions.chat.earlier' }));
    act(() => vi.runAllTimers());
    expect(asked).toEqual([4096]);
    expect(screen.queryByText('Prompt 50')).toBeNull();

    // The page lands: nothing moves until the spinner, still in view, is
    // seen again, and then the page is drawn at once.
    act(() =>
      chat.apply({
        older: 'end',
        before: 0,
        entries: Array.from({ length: 50 }, (_, i) => turn(i + 1)).flat(),
      }),
    );
    expect(screen.queryByText('Prompt 50')).toBeNull();
    observer.reach(screen.getByRole('status', { name: 'sessions.chat.earlier' }));
    expect(screen.getByText('Prompt 11')).toBeTruthy();
    expect(screen.queryByText('Prompt 10')).toBeNull();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }, 15_000);

  it('asks again at the top when a reconnect let the page it asked for go', () => {
    // What breaks this: the spinner left as the same element once the
    // reconnect's tail put the chat back to "more on the host", so the
    // observer, which only reports a change, never sees it again and the
    // reader waits at the top for a page that will never come.
    vi.useFakeTimers();
    const observer = observeIntersections();
    const chat = new Chat();
    const asked: number[] = [];
    chat.connect(
      () => {},
      (before) => asked.push(before),
    );
    const tail = Array.from({ length: 40 }, (_, i) => turn(i + 51)).flat();
    chat.apply({ reset: true, history: 'end', before: 4096, entries: tail });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    const spinner = screen.getByRole('status', { name: 'sessions.chat.earlier' });
    observer.reach(spinner);
    act(() => vi.runAllTimers());
    expect(asked).toEqual([4096]);

    act(() => chat.apply({ reset: true, history: 'end', before: 4096, entries: tail }));
    const again = screen.getByRole('status', { name: 'sessions.chat.earlier' });
    expect(again).not.toBe(spinner);
    observer.reach(again);
    act(() => vi.runAllTimers());
    expect(asked).toEqual([4096, 4096]);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('keeps the turns a reader scrolled up to while new ones arrive, and follows again at the end', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: Array.from({ length: 90 }, (_, i) => turn(i + 1)).flat() });
    const { container } = render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    const box = container.querySelector<HTMLElement>('.overflow-y-auto');
    if (!box) throw new Error('no scrolling column');
    // jsdom lays nothing out: a column taller than its box, read from the end, then from the top.
    Object.defineProperty(box, 'scrollHeight', { configurable: true, value: 10_000 });
    Object.defineProperty(box, 'clientHeight', { configurable: true, value: 500 });
    const scrollTo = (top: number) => {
      box.scrollTop = top;
      fireEvent.scroll(box);
    };
    scrollTo(9_500);
    // The reader turns the wheel up: a move up that is theirs.
    fireEvent.wheel(box, { deltaY: -9_500 });
    scrollTo(0);

    act(() => chat.apply({ entries: turn(91) }));
    expect(screen.getByText('Prompt 91')).toBeTruthy();
    expect(screen.getByText('Prompt 51')).toBeTruthy();

    scrollTo(9_500);
    act(() => chat.apply({ entries: turn(92) }));
    expect(screen.queryByText('Prompt 52')).toBeNull();
    expect(screen.getByText('Prompt 53')).toBeTruthy();
  });
});

describe('the work in a turn', () => {
  const call = (id: string, file: string) => ({
    type: 'tool_use',
    id,
    name: 'Read',
    input: { file_path: file },
  });

  it('folds reads into one Explored line naming each file once, which an edit ends', () => {
    const chat = new Chat();
    chat.apply({
      reset: true,
      entries: [
        entry({ type: 'user', uuid: 'u', message: { role: 'user', content: 'Fix it' } }),
        entry({
          type: 'assistant',
          uuid: 'a',
          message: {
            role: 'assistant',
            content: [
              call('t1', 'src/a.ts'),
              { type: 'tool_use', id: 't2', name: 'Grep', input: { pattern: 'cancel' } },
              call('t3', 'src/a.ts'),
              { type: 'tool_use', id: 't4', name: 'Edit', input: { file_path: 'src/a.ts' } },
            ],
          },
        }),
        entry({
          type: 'user',
          uuid: 'r',
          message: {
            role: 'user',
            content: ['t1', 't2', 't3', 't4'].map((id) => ({
              type: 'tool_result',
              tool_use_id: id,
              content: 'ok',
            })),
          },
        }),
        entry({
          type: 'assistant',
          uuid: 'b',
          message: { role: 'assistant', content: [{ type: 'text', text: 'Done.' }] },
        }),
      ],
    });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: /sessions\.chat\.turn\.worked/ }));
    const explored = screen.getByRole('button', { name: /sessions\.chat\.explored\.title/ });
    expect(explored.textContent).toContain('common.chat.explored.read a.ts');
    expect(explored.textContent).toContain('common.chat.explored.search cancel');
    expect(explored.textContent?.match(/a\.ts/g)).toHaveLength(1);
    // The edit is its own row after the group, not one of its calls.
    expect(screen.getByText('sessions.chat.verb.edit')).toBeTruthy();
    fireEvent.click(explored);
    expect(screen.getAllByText('sessions.chat.verb.read')).toHaveLength(2);
  });

  it('keeps a run of reads folded under Exploring while the agent is still in it', () => {
    const chat = new Chat();
    chat.apply({
      reset: true,
      entries: [
        entry({ type: 'user', uuid: 'u', message: { role: 'user', content: 'Look around' } }),
        entry({
          type: 'assistant',
          uuid: 'a',
          message: {
            role: 'assistant',
            content: [call('t1', 'a.ts'), call('t2', 'b.ts'), call('t3', 'c.ts')],
          },
        }),
        entry({
          type: 'user',
          uuid: 'r',
          message: {
            role: 'user',
            content: [
              { type: 'tool_result', tool_use_id: 't1', content: 'a' },
              { type: 'tool_result', tool_use_id: 't2', content: 'b' },
            ],
          },
        }),
      ],
    });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    // The two done are one folded line naming them; the one in flight says so under it.
    const summary = screen.getByRole('button', { name: /sessions\.chat\.exploring/ });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.textContent).toContain('common.chat.explored.read a.ts, b.ts');
    expect(screen.getByText('c.ts')).toBeTruthy();
  });
});

describe('the queue and the context', () => {
  const prompt = entry({
    type: 'user',
    uuid: 'u1',
    message: { role: 'user', content: 'Fix the flaky test' },
  });
  const answer = (uuid: string) =>
    entry({
      type: 'assistant',
      uuid,
      message: {
        role: 'assistant',
        model: 'claude-opus-5-5',
        content: [{ type: 'text', text: 'Fixed.' }],
        usage: { input_tokens: 6, cache_read_input_tokens: 49_000, output_tokens: 994 },
      },
    });

  it('holds what is written while the agent works, to send now, edit or drop', async () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    const composer = () =>
      screen.getByPlaceholderText('sessions.chat.composer.placeholder{"agent":"Claude Code"}');

    const field = composer();
    for (const words of ['Then run the tests', 'And open a PR']) {
      fireEvent.change(composer(), { target: { value: words } });
      fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.composer.send' }));
      // The field clears once the send settles, a microtask later.
      await act(() => Promise.resolve());
    }
    act(() => vi.runAllTimers());
    expect(typed).toEqual([]);
    // The queue appearing over the field leaves the field where it was, focus and all.
    expect(composer()).toBe(field);
    expect(
      screen.getAllByText(/^(Then run the tests|And open a PR)$/).map((el) => el.textContent),
    ).toEqual(['Then run the tests', 'And open a PR']);

    // Edit takes it back into the field; remove drops it.
    const edits = screen.getAllByRole('button', { name: 'common.chat.queue.edit' });
    fireEvent.click(edits[1] as HTMLElement);
    expect((composer() as HTMLTextAreaElement).value).toBe('And open a PR');
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.queue.sendNow' }));
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['Then run the tests', '\r']);
    expect(screen.queryByRole('button', { name: 'common.chat.queue.remove' })).toBeNull();
    vi.useRealTimers();
  });

  it('sends the first queued message now on Enter in the empty field', async () => {
    // What breaks this: Enter on the empty field stopping the turn (Stop's
    // job) while a message waits, so "Enter twice" interrupts the agent.
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    const field = screen.getByPlaceholderText(
      'sessions.chat.composer.placeholder{"agent":"Claude Code"}',
    );

    for (const words of ['Then run the tests', 'And open a PR']) {
      fireEvent.change(field, { target: { value: words } });
      fireEvent.keyDown(field, { key: 'Enter' });
      await act(() => Promise.resolve());
    }
    expect(typed).toEqual([]);

    fireEvent.keyDown(field, { key: 'Enter' });
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['Then run the tests', '\r']);
    expect(screen.getByText('And open a PR')).toBeTruthy();
    expect(screen.queryByText('Then run the tests')).toBeNull();
    vi.useRealTimers();
  });

  it('shows how full the context is, and opens to it and the plan’s limits, compacting on asking', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, answer('a1')] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    // Counted off the transcript until the status line says otherwise.
    const meter = screen.getByRole('button', { name: /common\.chat\.usage\.open/ });
    expect(meter.textContent).toContain('25%');

    act(() =>
      chat.apply({
        entries: [
          JSON.stringify({
            type: 'oppenheimer.status',
            context_window: { used_percentage: 32, context_window_size: 200_000 },
            rate_limits: {
              five_hour: { used_percentage: 84, resets_at: 1_793_040_000 },
              seven_day: { used_percentage: 41 },
            },
          }),
        ],
      }),
    );
    expect(meter.textContent).toContain('32%');
    fireEvent.click(meter);
    expect(screen.getByText('common.chat.usage.plan')).toBeTruthy();
    expect(screen.getByText('common.chat.usage.fiveHour')).toBeTruthy();
    expect(screen.getByText('84%')).toBeTruthy();
    expect(screen.getByText('41%')).toBeTruthy();
    expect(screen.getByText(/"used":"64K","window":"200K"/)).toBeTruthy();
    // Nothing is typed until Compact is asked for.
    act(() => vi.runAllTimers());
    expect(typed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'common.chat.usage.compact' }));
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['/compact', '\r']);
    vi.useRealTimers();
  });

  // An OpenCode session's lines come from the host in the transcript's shape,
  // the model being whichever OpenCode ran. The composer names OpenCode, and
  // a model whose window the chat cannot know gets no meter at all.
  // Regression: an OpenCode chat signed "Claude Code", or a GPT turn's
  // tokens measured against a Claude window.
  it('names OpenCode on its chat, and measures no window it cannot know', () => {
    const chat = new Chat();
    chat.apply({
      reset: true,
      entries: [
        prompt,
        JSON.stringify({
          type: 'assistant',
          uuid: 'prt-1',
          message: {
            role: 'assistant',
            model: 'gpt-6.1-sol',
            content: [{ type: 'text', text: 'Done.' }],
            usage: { input_tokens: 50_000, output_tokens: 10 },
          },
        }),
      ],
    });
    render(<SessionChat chat={chat} agent="opencode" readOnly={false} />);
    expect(
      screen.getByPlaceholderText('sessions.chat.composer.placeholder{"agent":"OpenCode"}'),
    ).toBeTruthy();
    expect(screen.getByText('OpenCode')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /common\.chat\.usage\.open/ })).toBeNull();
  });

  it('shows no meter until the host sends the counts', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: [prompt] });
    render(<SessionChat chat={chat} agent="claude-code" readOnly={false} />);
    expect(screen.queryByRole('button', { name: /common\.chat\.usage\.open/ })).toBeNull();
  });
});

describe('subagents', () => {
  const at = (seconds: number) => new Date(Date.UTC(2026, 10, 6, 9, 0, seconds)).toISOString();
  const agentCall = (id: string, description: string) =>
    entry({
      type: 'assistant',
      uuid: `a-${id}`,
      timestamp: at(1),
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id, name: 'Agent', input: { description, subagent_type: 'Explore' } },
        ],
      },
    });

  // Regression: a turn that launched subagents said "Ran 2 subagents" and
  // nothing else until they had all ended; the terminal's footer listed each
  // with what it was doing.
  it('lists each subagent a turn started, what it is doing, and opens to its work', () => {
    const chat = new Chat();
    render(<SessionChat chat={chat} agent="claude-code" readOnly />);
    act(() =>
      chat.apply({
        reset: true,
        history: 'end',
        entries: [
          entry({
            type: 'user',
            uuid: 'u1',
            timestamp: at(0),
            message: { role: 'user', content: 'Find the picker' },
          }),
          agentCall('toolu_a', 'Read the collector'),
          agentCall('toolu_b', 'Fix the table'),
        ],
      }),
    );
    act(() =>
      chat.apply({
        entries: [
          entry({
            type: 'assistant',
            uuid: 's1',
            timestamp: at(2),
            isSidechain: true,
            agentId: 'ag-a',
            message: {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_grep',
                  name: 'Grep',
                  input: { pattern: 'Collector' },
                },
              ],
            },
          }),
          entry({
            type: 'oppenheimer.subagent',
            id: 'ag-a',
            parentToolUseId: 'toolu_a',
            agentType: 'Explore',
            state: 'running',
          }),
          entry({
            type: 'oppenheimer.subagent',
            id: 'ag-b',
            parentToolUseId: 'toolu_b',
            agentType: 'Explore',
            state: 'failed',
          }),
        ],
      }),
    );

    expect(
      screen.getByText(
        'sessions.chat.subagents.count{"count":2} · sessions.chat.subagents.running{"count":1} · sessions.chat.subagents.failed{"count":1}',
      ),
    ).toBeTruthy();
    const running = screen.getByText('Read the collector').closest('[data-slot="subagent-row"]');
    expect(running?.getAttribute('data-state')).toBe('running');
    // What it is doing now, on its line.
    expect(running?.textContent).toContain('sessions.chat.verbLive.search');
    expect(running?.textContent).toContain('Collector');
    expect(
      screen.getByText('Fix the table').closest('[data-slot="subagent-row"]')?.textContent,
    ).toContain('sessions.chat.subagents.state.failed');

    // Its own call, once in its row's activity; opened, once more as its work.
    const fold = screen.getByText('Read the collector').closest('[data-slot="subagent-fold"]');
    const mentions = () => fold?.textContent?.split('Collector').length ?? 0;
    const closed = mentions();
    fireEvent.click(screen.getByText('Read the collector'));
    expect(mentions()).toBe(closed + 1);
  });
});
