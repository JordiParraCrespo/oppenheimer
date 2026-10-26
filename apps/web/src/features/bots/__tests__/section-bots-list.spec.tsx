import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsList } from '../sections/section-bots-list';

/**
 * A section's Bots heading (`28-bots-in-sections.md`): which chat a row opens,
 * the section's own in Pull requests and Employees' everywhere else, and the
 * line it shows before the first bot. Which bots a section lists is the
 * product package's `useSuspenseSectionBots`, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const listed = vi.hoisted(() => ({ bots: [] as unknown[] }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseSectionBots: () => ({ data: listed.bots, error: null }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, ...props }: { to: string; params: { botId: string } }) => (
    <a href={to.replace('$botId', params.botId)} {...props} />
  ),
  useRouterState: () => false,
}));

function bot(id: string, name: string, sections: BotSection[]): BotEntity {
  const at = new Date('2026-10-26T09:00:00Z');
  return new BotEntity(
    id,
    name,
    'Ships releases',
    'mint',
    null,
    0,
    null,
    'anthropic',
    null,
    null,
    'auto',
    true,
    at,
    at,
    at,
    null,
    sections,
  );
}

afterEach(() => {
  cleanup();
  listed.bots = [];
});

describe('SectionBotsList', () => {
  it('opens a bot’s chat inside Pull requests, beside that section’s list', () => {
    listed.bots = [bot('b1', 'Release Bot', ['pulls'])];
    render(<SectionBotsList section="pulls" />);
    expect(screen.getByRole('listitem').getAttribute('href')).toBe('/pulls/bots/b1');
  });

  it('opens a bot’s chat in Employees from every other section', () => {
    listed.bots = [bot('b2', 'Session Bot', ['sessions'])];
    render(<SectionBotsList section="sessions" />);
    expect(screen.getByRole('listitem').getAttribute('href')).toBe('/bots/b2');
  });

  it('says how a bot gets here when the section has none', () => {
    render(<SectionBotsList section="plan" />);
    expect(screen.getByText('bots.section.empty')).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
