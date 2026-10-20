import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEventLine } from '../components/bot-event-line';

/**
 * A decided approval's trace line, and another bot's message or answer as a
 * card naming the bot Oppenheimer recorded. What breaks this: the line read
 * from the event's words (which are the bot's, in English, and may change),
 * so a denial draws as an approval or a translated line never appears; or a
 * bot's message drawn as a trace line that hides what it said.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { summary?: string }) => `${key}|${values?.summary ?? ''}`,
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
});
