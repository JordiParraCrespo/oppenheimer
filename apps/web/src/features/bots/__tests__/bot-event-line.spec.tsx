import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEventLine } from '../components/bot-event-line';

/**
 * A decided approval's trace line, a routine's, a followed session's, and
 * another bot's message or answer as a card naming the bot Oppenheimer
 * recorded. What breaks this:
 * the line read from the event's words (which are the bot's, in English, and
 * may change), so a denial draws as an approval, a routine as an approval, or
 * a translated line never appears; or a bot's message drawn as a trace line
 * that hides what it said.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { summary?: string; name?: string; reason?: string }) =>
      [key, values?.summary ?? values?.name ?? '', values?.reason].filter(Boolean).join('|'),
  }),
  Trans: ({ i18nKey, values }: { i18nKey: string; values?: { name?: string } }) =>
    `${i18nKey}|${values?.name ?? ''}`,
}));

afterEach(cleanup);

const event = (
  outcome: 'approved' | 'denied' | 'failed',
  content = 'Ana approved: x',
  sessionId: string | null = null,
) =>
  ({
    id: 'e1',
    role: 'event',
    content,
    event: { kind: 'approval', outcome, tool: 'start_session', summary: 'Start it', sessionId },
  }) as unknown as BotMessageEntity;

describe('BotEventLine', () => {
  it('says what was decided from the event’s fields, whatever its words say', () => {
    render(<BotEventLine message={event('denied', 'Ana approved: something else')} />);
    expect(screen.getByText('bots.chat.event.denied|Start it')).toBeTruthy();
  });

  it('draws a failed call apart from one that ran', () => {
    render(<BotEventLine message={event('failed')} />);
    expect(screen.getByText('bots.chat.event.failed|Start it')).toBeTruthy();
  });

  it('draws answered questions with each answer under the line, and a dismissal as dismissed', () => {
    const asked = (
      outcome: 'answered' | 'denied',
      answers?: { question: string; answer: string }[],
    ) =>
      ({
        id: `e-${outcome}`,
        role: 'event',
        content: 'Ana answered your questions.',
        event: {
          kind: 'approval',
          outcome,
          tool: 'ask_user',
          summary: 'Which repository?',
          sessionId: null,
          ...(answers && { answers }),
        },
      }) as unknown as BotMessageEntity;
    render(
      <BotEventLine
        message={asked('answered', [{ question: 'Which repository?', answer: 'acme/api' }])}
      />,
    );
    expect(screen.getByText('bots.chat.event.answered|Which repository?')).toBeTruthy();
    expect(screen.getByText('acme/api')).toBeTruthy();
    cleanup();
    render(<BotEventLine message={asked('denied')} />);
    expect(screen.getByText('bots.chat.event.dismissed|Which repository?')).toBeTruthy();
  });

  it('names the routine that woke the bot, not the words it was told', () => {
    const message = {
      id: 'e2',
      role: 'event',
      content: 'Your routine "Morning PR digest" is running now…',
      event: {
        kind: 'routine',
        activity: 'ran',
        automationId: 'a-1',
        runId: 'r-1',
        name: 'Morning PR digest',
        reason: null,
      },
    } as unknown as BotMessageEntity;
    render(<BotEventLine message={message} />);
    expect(screen.getByText('bots.chat.event.routine|Morning PR digest')).toBeTruthy();
  });

  const routine = (activity: string, reason: string | null) =>
    ({
      id: 'e3',
      turnId: null,
      role: 'event',
      content: 'Your routine "Morning PR digest" was paused.',
      event: {
        kind: 'routine',
        activity,
        automationId: 'a-1',
        runId: null,
        name: 'Morning PR digest',
        reason,
      },
    }) as unknown as BotMessageEntity;

  // What breaks this: a pause the owner made drawn as an alarm, or a pause
  // the owner must fix, or a run that never happened, drawn as a quiet line.
  it('draws what the owner did as a line, and what needs them as a notice that says why', () => {
    render(<BotEventLine message={routine('paused', 'user')} action={<a href="/x">open</a>} />);
    expect(screen.getByText('bots.chat.event.routinePaused|Morning PR digest')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText('open')).toBeNull();
    cleanup();

    render(
      <BotEventLine
        message={routine('paused', 'bot_provider_missing')}
        action={<a href="/x">open</a>}
      />,
    );
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('warning');
    expect(
      screen.getByText(
        'bots.chat.event.routinePausedBecause|Morning PR digest|bots.chat.routineReason.bot_provider_missing',
      ),
    ).toBeTruthy();
    expect(screen.getByText('open')).toBeTruthy();
    cleanup();

    render(<BotEventLine message={routine('failed', 'something-new')} />);
    expect(screen.getByRole('status').getAttribute('data-tone')).toBe('danger');
    expect(
      screen.getByText(
        'bots.chat.event.routineFailed|Morning PR digest|bots.chat.routineReason.unknown',
      ),
    ).toBeTruthy();
  });

  it('links the session an approved call started, in a new tab', () => {
    render(<BotEventLine message={event('approved', 'Ana approved: x', 's-1')} />);
    const link = screen.getByRole('link', { name: /bots\.chat\.openSession/ });
    expect(link.getAttribute('href')).toBe('/sessions/s-1');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('offers no link when the call started no session', () => {
    render(<BotEventLine message={event('approved')} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('draws another bot’s ask as a card naming the recorded sender, with what it asked', () => {
    const asked = {
      id: 'e2',
      role: 'event',
      content: 'Which task is PR 412?\nThanks.',
      event: { kind: 'bot_message', fromBotId: 'b1', fromBotName: 'Ada', expectsReply: true },
    } as unknown as BotMessageEntity;
    const { container } = render(<BotEventLine message={asked} />);
    expect(screen.getByText('bots.chat.event.peerAsk|Ada')).toBeTruthy();
    expect(container.textContent).toContain('Which task is PR 412?\nThanks.');
    expect(container.querySelector('[data-slot="bot-exchange"]')).toBeTruthy();
  });

  it('draws an answer by how it came back: replied, or could not answer', () => {
    const reply = (outcome: 'answered' | 'failed') =>
      ({
        id: 'e3',
        role: 'event',
        content: 'Task 7.',
        event: { kind: 'bot_reply', fromBotId: 'b2', fromBotName: 'Grace', outcome },
      }) as unknown as BotMessageEntity;
    render(<BotEventLine message={reply('answered')} />);
    expect(screen.getByText('bots.chat.event.peerAnswered|Grace')).toBeTruthy();
    cleanup();
    render(<BotEventLine message={reply('failed')} />);
    expect(screen.getByText('bots.chat.event.peerFailed|Grace')).toBeTruthy();
  });
  // What breaks this: a session that failed drawn like one that finished,
  // or a wake with no way to the session the person has to look at.
  it('draws a followed session that woke the bot by its state, with the session to open', () => {
    const woke = (state: 'completed' | 'failed') =>
      ({
        id: 'e4',
        role: 'event',
        content: 'The session "Research" (s-2) you follow: its task #1 finished.',
        event: {
          kind: 'session',
          subscriptionId: 'sub-1',
          sessionId: 's-2',
          sessionName: 'Research',
          turn: 1,
          state,
        },
      }) as unknown as BotMessageEntity;
    const { container } = render(<BotEventLine message={woke('completed')} />);
    expect(screen.getByText('bots.chat.event.session.completed|Research')).toBeTruthy();
    expect(screen.getByRole('link', { name: /bots\.chat\.openSession/ }).getAttribute('href')).toBe(
      '/sessions/s-2',
    );
    expect(container.querySelector('.text-danger')).toBeNull();
    cleanup();
    const failed = render(<BotEventLine message={woke('failed')} />);
    expect(screen.getByText('bots.chat.event.session.failed|Research')).toBeTruthy();
    expect(failed.container.querySelector('.text-danger')).toBeTruthy();
  });
  it('draws a goal’s continuation and how it ended from the event, a stop in red', () => {
    const goal = (activity: 'continued' | 'stopped') =>
      ({
        id: `g-${activity}`,
        role: 'event',
        content: 'Continue toward your goal…',
        event: {
          kind: 'goal',
          activity,
          goalId: 'goal-1',
          objective: 'Ship it',
          step: 2,
          limit: 5,
          reason: activity === 'stopped' ? 'failed' : null,
        },
      }) as unknown as BotMessageEntity;
    render(<BotEventLine message={goal('continued')} />);
    expect(screen.getByText(/^bots\.chat\.event\.goal\.continued/)).toBeTruthy();
    const stopped = render(<BotEventLine message={goal('stopped')} />);
    expect(screen.getByText(/^bots\.chat\.event\.goal\.stopped/)).toBeTruthy();
    expect(stopped.container.querySelector('.text-danger')).toBeTruthy();
  });
});
