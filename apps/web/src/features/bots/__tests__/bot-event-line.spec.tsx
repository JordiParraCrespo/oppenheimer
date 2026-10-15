import type { BotMessageEntity } from '@oppenheimer/frontend-consumer';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BotEventLine } from '../components/bot-event-line';

/**
 * A decided approval's trace line. What breaks this: the line read from the
 * event's words (which are the bot's, in English, and may change), so a
 * denial draws as an approval or a translated line never appears.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { summary?: string }) => `${key}|${values?.summary ?? ''}`,
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
});
