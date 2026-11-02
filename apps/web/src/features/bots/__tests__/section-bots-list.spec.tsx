import { BotEntity } from '@oppenheimer/frontend-consumer';
import type { BotSection } from '@oppenheimer/shared/schemas/bot';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionBotsList } from '../sections/section-bots-list';

/**
 * A section's Bots heading (`28-bots-in-sections.md`): a row opens the bot's
 * chat inside that section, so the reader never leaves it, and the heading
 * says how one gets here before the first bot. A row's ellipsis hands its
 * Hide to the heading, which owns every placement write, and asks before its
 * Delete removes the bot for good. Which bots a section lists is the product
 * package's `useSuspenseSectionBots`, mocked here.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const listed = vi.hoisted(() => ({ bots: [] as unknown[] }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSuspenseSectionBots: () => ({ data: listed.bots, error: null }),
  useDeleteBot: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useUpdateBot: () => ({ mutate: vi.fn(), error: null, reset: vi.fn() }),
  useBotsSnapshot: () => () => listed.bots,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, ...props }: { to: string; params: { botId: string } }) => (
    <a href={to.replace('$botId', params.botId)} {...props} />
  ),
  useRouterState: () => false,
  useNavigate: () => vi.fn(),
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

beforeEach(() => {
  // The drag layer asks whether the reader prefers reduced motion; jsdom has no media queries.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
  listed.bots = [];
});

describe('SectionBotsList', () => {
  it('opens a bot’s chat inside Pull requests, beside that section’s list', () => {
    listed.bots = [bot('b1', 'Release Bot', ['pulls'])];
    render(<SectionBotsList section="pulls" onAdd={() => {}} onHide={() => {}} />);
    expect(screen.getByRole('link').getAttribute('href')).toBe('/pulls/bots/b1');
  });

  it('opens a bot’s chat inside Sessions, Automations and Plan too, never in Employees', () => {
    listed.bots = [bot('b2', 'Session Bot', ['sessions', 'automations', 'plan'])];
    for (const section of ['sessions', 'automations', 'plan'] as const) {
      render(<SectionBotsList section={section} onAdd={() => {}} onHide={() => {}} />);
      expect(screen.getByRole('link').getAttribute('href')).toBe(`/${section}/bots/b2`);
      cleanup();
    }
  });

  it('offers the heading’s menu when the section has no bot yet', () => {
    const onAdd = vi.fn();
    render(<SectionBotsList section="plan" onAdd={onAdd} onHide={() => {}} />);
    expect(screen.getByText(/bots\.section\.empty/)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'bots.section.add' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('hands a row’s Hide to the heading with the bot it hides', async () => {
    const release = bot('b3', 'Release Bot', ['sessions', 'pulls']);
    listed.bots = [release];
    const onHide = vi.fn();
    render(<SectionBotsList section="pulls" onAdd={() => {}} onHide={onHide} />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.sidebar.rowActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bots.section.hide' }));
    expect(onHide).toHaveBeenCalledWith(release);
  });

  it('lets each row be picked up from the keyboard, while Enter still opens its chat', () => {
    listed.bots = [bot('b5', 'Release Bot', ['pulls']), bot('b6', 'Planning Bot', ['pulls'])];
    render(<SectionBotsList section="pulls" onAdd={() => {}} onHide={() => {}} />);
    for (const link of screen.getAllByRole('link')) {
      // The drag layer's role description, and its instructions for a row that is also a link.
      expect(link.getAttribute('aria-roledescription')).toBe('sortable');
      expect(link.getAttribute('aria-describedby')).toBeTruthy();
    }
  });

  it('asks before a row’s Delete removes the bot, from the section’s sidebar', async () => {
    listed.bots = [bot('b4', 'Release Bot', ['sessions'])];
    render(<SectionBotsList section="sessions" onAdd={() => {}} onHide={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'bots.sidebar.rowActions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'bots.sidebar.delete' }));
    expect(await screen.findByText('bots.delete.title')).toBeTruthy();
  });
});
