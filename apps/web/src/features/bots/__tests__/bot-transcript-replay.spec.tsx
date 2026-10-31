import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { replayBotChat } from './replay/bot-chat-replay';
import { incidentLive } from './replay/incident-live.recording';
import { releaseWeek } from './replay/release-week.recording';

/**
 * A bot's chat replayed from recorded conversations, wire to screen: the
 * API's reads and the stream's frames go through the product package's
 * repository, stream and `useBotLive` into `BotTranscript`. What breaks
 * this: a turn's steps drawn out of the order they ran, a stored paragraph
 * drawn again beside the live text that wrote it, the write head or the live
 * line left on a turn that ended, a running `delegate` call's children hidden
 * until it ends, an event this build cannot read dropped instead of shown as
 * its first line, or a failed turn that does not say why.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}${JSON.stringify(values)}` : key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children?: ReactNode }) => <a href="/">{children}</a>,
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
  // The live line's clock reads the time; the recordings ran twelve seconds into their turn.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-30T09:00:12.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** An element's words, a space between each run of text. */
function words(element: Element | null | undefined): string {
  if (!element) return '';
  const runs: string[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const run = node.textContent?.trim();
    if (run) runs.push(run);
  }
  return runs.join(' ');
}

/**
 * The transcript as a reader scans it, top to bottom: the dividers, your
 * messages, each turn by how it stands, and in it its trace lines, what it
 * said (`▍` where the write head is), what it is doing now and why it failed.
 */
function outline(root: HTMLElement): string[] {
  const parts = root.querySelectorAll(
    [
      '[data-slot="transcript-divider"]',
      '[data-slot="chat-user-message"]',
      '[data-slot="bot-turn"]',
      '[data-slot="trace-step"][role="listitem"]',
      '[data-slot="trace-group"]',
      '[data-slot="chat-reply"]',
      '[role="status"]',
      '[role="alert"]',
    ].join(','),
  );
  return [...parts].flatMap((part) => {
    switch (part.getAttribute('data-slot')) {
      case 'transcript-divider':
        return [`── ${words(part)} ──`];
      case 'chat-user-message':
        return [`you: ${words(part.firstElementChild)}`];
      case 'bot-turn':
        return [`bot (${part.getAttribute('data-phase')})`];
      case 'chat-reply':
        return [
          `  “${words(part)}${part.querySelector('[data-slot="streaming-caret"]') ? '▍' : ''}”`,
        ];
      case 'trace-group':
        return [`  ${words(part.querySelector('button'))}`];
    }
    if (part.getAttribute('role') === 'listitem') {
      // A group's own steps are drawn under its line only once it is open.
      return part.closest('[data-slot="trace-group"]')
        ? [`    ${words(part.querySelector('button'))}`]
        : [`  ${words(part.querySelector('button'))}`];
    }
    if (part.getAttribute('role') === 'status') return [`  … ${words(part)}`];
    return [`  ! ${words(part)}`];
  });
}

/** Whether `first` is drawn above `second`. */
const above = (first: HTMLElement, second: HTMLElement) =>
  Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('a settled week, replayed', () => {
  it('draws each turn once, in the order it ran, its steps in order and how it ended', async () => {
    const chat = await replayBotChat(releaseWeek);

    expect(outline(chat.container)).toEqual([
      'you: Draft the release notes for 2.4',
      'bot (completed)',
      '  bots.chat.activity.group{"count":2}',
      '  “Release 2.4 Dark mode in Settings A steadier sign-in”',
      '── bots.chat.event.approved{"summary":"Run the release checklist"} bots.chat.openSession ──',
      'bot (completed)',
      '  Start session Run the checklist',
      '  “The checklist is running in its own session.”',
      '── Oct 29, 2026 ──',
      'you: Check the three open PRs in parallel',
      'bot (completed)',
      '  bots.chat.activity.delegated{"count":3} bots.chat.activity.groupFailed{"count":1}',
      '  “Two are green; #820 could not be read.”',
      '── Calendar: the release review moved to 16:00 ──',
      'you: Publish them to the blog',
      'bot (failed)',
      '  ! bots.chat.failure.credential{"provider":"Anthropic"} 401 invalid x-api-key bots.chat.errorDetails bots.chat.openProviders',
    ]);
    expect(chat.streamUrl).toBe('http://api.test/api/v1/bots/bot-release/stream');
    expect(chat.strays).toEqual([]);
  });

  it('folds calls made together into one line that opens to each, in the order they ran', async () => {
    const chat = await replayBotChat(releaseWeek);

    const group = screen.getByRole('button', { name: 'bots.chat.activity.group{"count":2}' });
    expect(group.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(group);
    expect(outline(chat.container).slice(2, 5)).toEqual([
      '  bots.chat.activity.group{"count":2}',
      '    Read pull request',
      '    Read pull request',
    ]);
    // What it wrote is markdown, not the source of it.
    expect(screen.getByRole('heading', { name: 'Release 2.4' })).toBeTruthy();
    expect(screen.queryByText(/## Release/)).toBeNull();
  });

  it('links the session an approved call started, from the approval and from its step', async () => {
    await replayBotChat(releaseWeek);

    const links = screen.getAllByRole('link', { name: 'bots.chat.openSession' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/sessions/sess-42',
      '/sessions/sess-42',
    ]);
  });

  it('opens a delegate call to the subagents it ran, the one that failed said so', async () => {
    await replayBotChat(releaseWeek);

    fireEvent.click(screen.getByRole('button', { name: /bots\.chat\.activity\.delegated/ }));
    expect(screen.getByText('Check #812')).toBeTruthy();
    expect(screen.getByText('Check #820')).toBeTruthy();
    expect(screen.getByText(/bots\.chat\.activity\.subagent\.failed/)).toBeTruthy();
  });

  it('shows an event this build cannot read as a divider of its first line, not as nothing', async () => {
    await replayBotChat(releaseWeek);

    const line = screen.getByText('Calendar: the release review moved to 16:00');
    expect(line.closest('[role="separator"]')).not.toBeNull();
    expect(screen.queryByText(/It was at 14:00/)).toBeNull();
  });

  it('says why the last turn failed, and offers the fix rather than a Retry that fails alike', async () => {
    await replayBotChat(releaseWeek);

    const failure = screen.getByRole('alert');
    expect(within(failure).getByText(/bots\.chat\.failure\.credential/)).toBeTruthy();
    expect(within(failure).getByRole('button', { name: 'bots.chat.openProviders' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'bots.chat.retry' })).toBeNull();
  });
});

describe('a turn recorded while it ran, replayed', () => {
  it('thinks, then writes the streamed words with the write head after them', async () => {
    const chat = await replayBotChat(incidentLive);
    await chat.playTo('opened');
    expect(outline(chat.container)).toEqual([
      'you: Summarise last night’s incident',
      'bot (thinking)',
      '  … bots.chat.turn.thinking{} 00:12',
    ]);

    await chat.playTo('writing');
    expect(outline(chat.container)).toEqual([
      'you: Summarise last night’s incident',
      'bot (working)',
      '  “The deploy at 02:10 failed its health check.▍”',
      '  … bots.chat.turn.writing{} 00:12',
    ]);
  });

  it('draws a paragraph once when its stored copy lands beside the live one', async () => {
    const chat = await replayBotChat(incidentLive);
    await chat.playTo('stored');

    expect(screen.getAllByText('The deploy at 02:10 failed its health check.')).toHaveLength(1);
    expect(chat.container.querySelector('[data-slot="streaming-caret"]')).toBeNull();
  });

  it('shows the children of a running delegate call as the stream moves them', async () => {
    const chat = await replayBotChat(incidentLive);
    await chat.playTo('delegating');

    const live = screen.getByRole('status');
    expect(above(screen.getByText('Read the logs'), screen.getByText('Read the alerts'))).toBe(
      true,
    );
    expect(above(live, screen.getByText('Read the logs'))).toBe(true);
    // The one at work runs its clock; the one waiting says so.
    expect(screen.getAllByText('bots.chat.activity.subagent.queued')).toHaveLength(1);
  });

  it('says it waits on the provider, then writes on after the stored paragraph', async () => {
    const chat = await replayBotChat(incidentLive);
    await chat.playTo('waiting');
    expect(words(screen.getByRole('status'))).toContain('bots.chat.turn.retrying.rate_limit');

    await chat.playTo('resumed');
    expect(outline(chat.container)).toEqual([
      'you: Summarise last night’s incident',
      'bot (working)',
      '  “The deploy at 02:10 failed its health check.”',
      '  bots.chat.activity.delegated{"count":2}',
      '  “It ran out of memory,▍”',
      '  … bots.chat.turn.writing{} 00:12',
    ]);
  });

  it('ends on the stored answer, with no live text, no live line and its trail', async () => {
    const chat = await replayBotChat(incidentLive);
    await chat.playAll();

    expect(outline(chat.container)).toEqual([
      'you: Summarise last night’s incident',
      'bot (completed)',
      '  “The deploy at 02:10 failed its health check.”',
      '  bots.chat.activity.delegated{"count":2}',
      '  “It ran out of memory, and was rolled back at 02:20.”',
    ]);
    expect(screen.getByRole('button', { name: 'bots.chat.copyReply' })).toBeTruthy();
    // Every nudge was a read of the conversation, and nothing else was asked for.
    expect(chat.reads).toBeGreaterThan(1);
    expect(chat.strays).toEqual([]);
  });
});
