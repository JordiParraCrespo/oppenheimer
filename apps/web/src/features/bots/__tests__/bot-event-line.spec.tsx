import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEventLine } from '../components/bot-event-line';

/**
 * A decided approval's trace line, and a routine's. What breaks this: the
 * line read from the event's words (which are the bot's, in English, and may
 * change), so a denial draws as an approval, a routine as an approval, or a
 * translated line never appears.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { summary?: string; name?: string; reason?: string }) =>
      [key, values?.summary ?? values?.name ?? '', values?.reason].filter(Boolean).join('|'),
  }),
}));

afterEach(cleanup);

const event = (outcome: 'approved' | 'denied' | 'failed', content = 'Ana approved: x') =>
  ({
    id: 'e1',
    role: 'event',
    content,
    event: { kind: 'approval', outcome, tool: 'start_session', summary: 'Start it' },
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
});
