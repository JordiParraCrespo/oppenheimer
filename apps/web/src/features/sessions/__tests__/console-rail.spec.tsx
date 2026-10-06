import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleRail } from '../sections/console-rail';

/**
 * The rail a reader can drag: it draws the lists in the order they left
 * them, and a list's count is still read out beside the drag instructions
 * (the sortable control's own description once replaced the count).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: () => ({ data: 3 }),
  useTasks: () => ({ data: 2 }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/console', () => ({ useConsoleList: () => 'sessions' }));

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
  window.localStorage.clear();
});

const description = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '');

describe('ConsoleRail', () => {
  it('draws the lists in the order the reader left them', () => {
    window.localStorage.setItem('oppenheimer.rail.order', JSON.stringify(['plan', 'pulls']));
    render(<ConsoleRail />);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'nav.plan',
      'nav.pullRequests',
      'nav.sessions',
      'nav.automations',
    ]);
  });

  it('reads a list’s count beside the drag instructions', () => {
    render(<ConsoleRail />);
    const sessions = screen.getByRole('link', { name: 'nav.sessions' });
    const read = description(sessions);
    expect(read).toContain('3');
    expect(read.some((text) => text.length > 1)).toBe(true);
  });
});
