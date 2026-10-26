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

  it('keeps what was written while the files uploaded, which the message did not carry', async () => {
    let arrive: () => void = () => {};
    pasteFile.mockReset().mockReturnValue(
      new Promise<void>((resolve) => {
        arrive = resolve;
      }),
    );
    const { files, typed } = renderAttaching();
    act(() => files.deliver([png('trace.png')]));
    const field = screen.getByPlaceholderText('sessions.chat.composer.placeholder');
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
    render(<SessionChat chat={new Chat()} readOnly={false} />);
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
    render(<SessionChat chat={chat} readOnly={false} />);
    // The picker holds the terminal's input: a message typed now would land in it.
    expect(
      screen.getByPlaceholderText('sessions.chat.composer.placeholder').closest('[hidden]'),
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
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.question.submit' }));
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
    render(<SessionChat chat={chat} readOnly={false} />);
    fireEvent.change(screen.getByLabelText('sessions.chat.question.ownAnswerLabel'), {
      target: { value: 'Only icons' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.question.next' }));
    const submit = screen.getByRole('button', { name: 'sessions.chat.question.submit' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.question.dismiss' }));
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
    const { unmount } = render(<SessionChat chat={chat} readOnly={false} />);
    expect(screen.getByText('Components')).toBeTruthy();
    expect(screen.getByText('Web, Linux')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('sessions.chat.composer.placeholder').closest('[hidden]'),
    ).toBeNull();
    unmount();

    const declined = new Chat();
    declined.apply({
      reset: true,
      entries: [prompt, ask, result("The user doesn't want to proceed with this tool use.", true)],
    });
    render(<SessionChat chat={declined} readOnly={false} />);
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
    render(<SessionChat chat={chat} readOnly={false} />);
    expect(screen.getByText('Scope')).toBeTruthy();
    // Focus is on the first option, so the number keys answer without a click.
    const first = screen.getByRole('button', { name: /Tokens/ });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: '2' });
    act(() => vi.runAllTimers());
    // The picker sends a lone one-choice question on the pick: no review to confirm.
    expect(typed).toEqual(['2']);
    expect(screen.getAllByText('sessions.chat.question.sending').length).toBeGreaterThan(0);
    vi.useRealTimers();
  });

  it('moves on with Enter from an answer in the person’s own words', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, lone] });
    render(<SessionChat chat={chat} readOnly={false} />);
    const own = screen.getByLabelText('sessions.chat.question.ownAnswerLabel');
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
    render(<SessionChat chat={chat} readOnly={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Components/ }));
    expect(screen.queryByText('sessions.chat.question.sending')).toBeNull();
    const submit = screen.getByRole('button', { name: 'sessions.chat.question.submit' });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows a watcher that the agent is waiting, with nothing to answer it with', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: [prompt, ask] });
    render(<SessionChat chat={chat} readOnly />);
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

  it('draws its latest turns and the earlier ones on asking, a page at a time', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: Array.from({ length: 90 }, (_, i) => turn(i + 1)).flat() });
    render(<SessionChat chat={chat} readOnly={false} />);
    expect(screen.getByText('Prompt 90')).toBeTruthy();
    expect(screen.getByText('Prompt 51')).toBeTruthy();
    expect(screen.queryByText('Prompt 50')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /sessions.chat.earlier\{"count":40\}/ }));
    expect(screen.getByText('Prompt 11')).toBeTruthy();
    expect(screen.queryByText('Prompt 10')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /sessions.chat.earlier\{"count":10\}/ }));
    expect(screen.getByText('Prompt 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /sessions.chat.earlier/ })).toBeNull();
    // Ninety turns drawn and two more pages: 2.6s alone, past vitest's 5s
    // default when the whole repository's suites run side by side.
  }, 15_000);

  it('keeps the turns a reader scrolled up to while new ones arrive, and follows again at the end', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: Array.from({ length: 90 }, (_, i) => turn(i + 1)).flat() });
    const { container } = render(<SessionChat chat={chat} readOnly={false} />);
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

  it('keeps a run of calls folded to its summary while the agent is still in it', () => {
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
    render(<SessionChat chat={chat} readOnly={false} />);
    // The two done are one folded line; the one in flight says so under it.
    const summary = screen.getByRole('button', { name: /sessions\.chat\.summary\.read/i });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('a.ts')).toBeNull();
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
    render(<SessionChat chat={chat} readOnly={false} />);
    const composer = () => screen.getByPlaceholderText('sessions.chat.composer.placeholder');

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
    const edits = screen.getAllByRole('button', { name: 'sessions.chat.queue.edit' });
    fireEvent.click(edits[1] as HTMLElement);
    expect((composer() as HTMLTextAreaElement).value).toBe('And open a PR');
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.queue.sendNow' }));
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['Then run the tests', '\r']);
    expect(screen.queryByRole('button', { name: 'sessions.chat.queue.remove' })).toBeNull();
    vi.useRealTimers();
  });

  it('shows how full the context is, and opens to it and the plan’s limits, compacting on asking', () => {
    vi.useFakeTimers();
    const chat = new Chat();
    const typed: string[] = [];
    chat.connect((data) => typed.push(data));
    chat.apply({ reset: true, entries: [prompt, answer('a1')] });
    render(<SessionChat chat={chat} readOnly={false} />);
    // Counted off the transcript until the status line says otherwise.
    const meter = screen.getByRole('button', { name: /sessions\.chat\.usage\.open/ });
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
    expect(screen.getByText('sessions.chat.usage.plan')).toBeTruthy();
    expect(screen.getByText('sessions.chat.usage.fiveHour')).toBeTruthy();
    expect(screen.getByText('84%')).toBeTruthy();
    expect(screen.getByText('41%')).toBeTruthy();
    expect(screen.getByText(/"used":"64K","window":"200K"/)).toBeTruthy();
    // Nothing is typed until Compact is asked for.
    act(() => vi.runAllTimers());
    expect(typed).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'sessions.chat.usage.compact' }));
    act(() => vi.runAllTimers());
    expect(typed).toEqual(['/compact', '\r']);
    vi.useRealTimers();
  });

  it('shows no meter until the host sends the counts', () => {
    const chat = new Chat();
    chat.apply({ reset: true, entries: [prompt] });
    render(<SessionChat chat={chat} readOnly={false} />);
    expect(screen.queryByRole('button', { name: /sessions\.chat\.usage\.open/ })).toBeNull();
  });
});
