import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { words } from '@/__tests__/support/words';
import flakySignIn from './replay/flaky-sign-in.jsonl?raw';
import { replaySessionChat } from './replay/session-chat-replay';

/**
 * A Claude Code session's chat replayed from its recorded transcript: a
 * read, a command that failed, a question the person answered, a task list,
 * an edit and a reply, then a second prompt whose command runs. What breaks
 * this: a turn's steps drawn out of the order the agent took them, an
 * older turn left open (or the newest folded) once the next prompt passes
 * it, a question that waits without taking the composer's place, the task
 * list lost from the composer, the call in flight drawn as done, or a turn
 * that settled still saying it works.
 */

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useVoiceDictation: () => ({ available: false, transcribe: vi.fn() }),
  usePasteSessionFile: () => ({ mutateAsync: vi.fn() }),
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

beforeEach(() => {
  // The live clocks read the time; the recording's second command started at 10:05:03.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T10:05:15.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** What each part of a turn is, as the outline names it. */
const PARTS: Record<string, string> = {
  'turn-header': 'header',
  'reasoning-row': 'thinking',
  'tool-call-group': 'calls',
  'tool-call-row': 'call',
  'tool-call-live': 'running',
  'chat-reply': 'reply',
  'answered-questions': 'answered',
  'changed-files-card': 'changes',
  'chat-marker': 'note',
};

/**
 * The chat as a reader scans it, top to bottom: each prompt, then the
 * agent's turn under its header (`▾` open, `▸` folded, `…` working), and
 * each part of the turn that is drawn, a call inside a group indented.
 */
function outline(root: HTMLElement): string[] {
  const selector = ['chat-user-message', ...Object.keys(PARTS)]
    .map((slot) => `[data-slot="${slot}"]`)
    .join(',');
  return [...root.querySelectorAll(selector)].map((part) => {
    const slot = part.getAttribute('data-slot') as string;
    if (slot === 'chat-user-message') return `you: ${words(part.firstElementChild)}`;
    if (slot === 'turn-header') {
      const open = part.getAttribute('aria-expanded');
      const state = open === null ? '…' : open === 'true' ? '▾' : '▸';
      return `${state} ${words(part)}`;
    }
    const nested =
      slot === 'tool-call-row' && part.parentElement?.closest('[data-slot="tool-call-group"]');
    // A group's line is its summary; the calls it opens to are lines of their own.
    const shown = slot === 'tool-call-group' ? part.querySelector('button') : part;
    return `${nested ? '    ' : '  '}${PARTS[slot]}: ${words(shown)}`;
  });
}

/**
 * A turn's time as the header shows it: in the host's time zone, so the
 * outline reads the same on a machine that is not on UTC.
 */
const clock = (iso: string) =>
  new Intl.DateTimeFormat('en', { timeStyle: 'short' }).format(new Date(iso));

const composer = () => screen.getByPlaceholderText('sessions.chat.composer.placeholder');

describe('a session replayed from its transcript', () => {
  it('stops on the question it asked, which takes the composer’s place', () => {
    vi.setSystemTime(new Date('2026-10-30T10:00:50.000Z'));
    const chat = replaySessionChat(flakySignIn);

    expect(outline(chat.container)).toEqual([
      'you: The sign-in test is flaky — find out why',
      '… sessions.chat.turn.working 50s',
      '  thinking: sessions.chat.thoughtFor{"seconds":4}',
      '  calls: Sessions.chat.summary.read{"count":1}, sessions.chat.summary.command{"count":1} , sessions.chat.failed{"count":1}',
      '  note: sessions.chat.question.waiting',
    ]);
    // The picker holds the terminal's input: a message typed now would land in it.
    expect(composer().closest('[hidden]')).not.toBeNull();
    expect(screen.getByText('Which fix?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Wait for the toast/ })).toBeTruthy();
    expect(chat.typed).toEqual([]);
  });

  it('keeps the turn’s steps in the order the agent took them, the task list on the composer', () => {
    const chat = replaySessionChat(flakySignIn);
    chat.playTo('answered');

    expect(outline(chat.container)).toEqual([
      'you: The sign-in test is flaky — find out why',
      `▾ sessions.chat.turn.worked 1m 20s · ${clock('2026-10-30T10:01:20.000Z')}`,
      '  thinking: sessions.chat.thoughtFor{"seconds":4}',
      '  calls: Sessions.chat.summary.read{"count":1}, sessions.chat.summary.command{"count":1} , sessions.chat.failed{"count":1}',
      '  answered: Which fix? Wait for the toast',
      '  call: sessions.chat.verb.edit sign-in.spec.ts tests +2 −1',
      '  reply: Fixed: the test now waits for the toast before it reads the URL.',
      '  changes: sessions.chat.changes{"count":1} +2 −1 tests/sign-in.spec.ts +2 −1',
    ]);
    // The composer is back, with the list the agent last wrote within reach.
    expect(composer().closest('[hidden]')).toBeNull();
    expect(screen.getByText('Run the whole suite')).toBeTruthy();
  });

  it('opens a run of calls to each, the failure in red with its first line', () => {
    const chat = replaySessionChat(flakySignIn);
    chat.playTo('answered');

    fireEvent.click(screen.getByRole('button', { name: /sessions\.chat\.summary\.read/i }));
    expect(outline(chat.container).slice(3, 6)).toEqual([
      '  calls: Sessions.chat.summary.read{"count":1}, sessions.chat.summary.command{"count":1} , sessions.chat.failed{"count":1}',
      '    call: sessions.chat.verb.read sign-in.spec.ts tests',
      '    call: sessions.chat.verb.command pnpm test sign-in --repeat 20 sessions.chat.failedCall',
    ]);
    expect(screen.getByText('3 of 20 runs failed')).toBeTruthy();
  });

  it('folds the older turn to its words and cards once the next prompt passes it, the newest live', () => {
    const chat = replaySessionChat(flakySignIn);
    chat.playTo('suite-running');

    expect(outline(chat.container)).toEqual([
      'you: The sign-in test is flaky — find out why',
      `▸ sessions.chat.turn.worked 1m 20s · ${clock('2026-10-30T10:01:20.000Z')}`,
      '  answered: Which fix? Wait for the toast',
      '  reply: Fixed: the test now waits for the toast before it reads the URL.',
      '  changes: sessions.chat.changes{"count":1} +2 −1 tests/sign-in.spec.ts +2 −1',
      'you: Now run the whole suite',
      '… sessions.chat.turn.working 15s',
      '  reply: Running the suite.',
      '  running: sessions.chat.verbLive.command pnpm test 12s',
    ]);
    // While it works, send is Stop.
    expect(screen.getByRole('button', { name: 'sessions.chat.composer.stop' })).toBeTruthy();
  });

  it('settles the newest turn open, and opens the older one again from its header', () => {
    const chat = replaySessionChat(flakySignIn);
    chat.playAll();

    expect(outline(chat.container).slice(5)).toEqual([
      'you: Now run the whole suite',
      `▾ sessions.chat.turn.worked 1m 32s · ${clock('2026-10-30T10:06:32.000Z')}`,
      '  reply: Running the suite.',
      '  call: sessions.chat.verb.command pnpm test',
      '  reply: All 212 tests pass.',
    ]);
    expect(screen.queryByRole('button', { name: 'sessions.chat.composer.stop' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /sessions\.chat\.turn\.worked 1m 20s/ }));
    expect(outline(chat.container).slice(0, 8)).toEqual([
      'you: The sign-in test is flaky — find out why',
      `▾ sessions.chat.turn.worked 1m 20s · ${clock('2026-10-30T10:01:20.000Z')}`,
      '  thinking: sessions.chat.thoughtFor{"seconds":4}',
      '  calls: Sessions.chat.summary.read{"count":1}, sessions.chat.summary.command{"count":1} , sessions.chat.failed{"count":1}',
      '  answered: Which fix? Wait for the toast',
      '  call: sessions.chat.verb.edit sign-in.spec.ts tests +2 −1',
      '  reply: Fixed: the test now waits for the toast before it reads the URL.',
      '  changes: sessions.chat.changes{"count":1} +2 −1 tests/sign-in.spec.ts +2 −1',
    ]);
    expect(within(chat.container).getAllByText(/Fixed: the test now/)).toHaveLength(1);
  });
});
