import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleRail } from '../sections/console-rail';

/**
 * The rail a reader can drag: under the mark, a link home, it draws the
 * lists in the order they left them, and a list's count is still read out beside the drag instructions
 * (the sortable control's own description once replaced the count).
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const waiting = vi.hoisted(() => ({ any: false }));

vi.mock('@oppenheimer/frontend-consumer/react', () => ({
  useSessions: () => ({ data: 3 }),
  useTasks: () => ({ data: 2 }),
  useAnyBotNeedsInput: () => waiting.any,
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
  waiting.any = false;
});

const description = (element: HTMLElement) =>
  (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '');

describe('ConsoleRail', () => {
  it('draws the lists in the order the reader left them, under the mark that leads home', () => {
    window.localStorage.setItem('oppenheimer.rail.order', JSON.stringify(['plan', 'pulls']));
    render(<ConsoleRail />);
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'nav.home',
      'nav.plan',
      'nav.pullRequests',
      'nav.employees',
      'nav.sessions',
      'nav.automations',
    ]);
    expect(screen.getByRole('link', { name: 'nav.home' }).getAttribute('href')).toBe('/');
  });

  it('reads a list’s count beside the drag instructions', () => {
    render(<ConsoleRail />);
    const sessions = screen.getByRole('link', { name: 'nav.sessions' });
    const read = description(sessions);
    expect(read).toContain('3');
    expect(read.some((text) => text.length > 1)).toBe(true);
  });

  it('puts the amber dot on Employees, and only there, while a bot waits on the reader', () => {
    const { unmount } = render(<ConsoleRail />);
    expect(screen.getByRole('link', { name: 'nav.employees' }).hasAttribute('data-attention')).toBe(
      false,
    );
    unmount();

    waiting.any = true;
    render(<ConsoleRail />);
    expect(screen.getByRole('link', { name: 'nav.employees' }).hasAttribute('data-attention')).toBe(
      true,
    );
    expect(screen.getByRole('link', { name: 'nav.sessions' }).hasAttribute('data-attention')).toBe(
      false,
    );
  });
});
