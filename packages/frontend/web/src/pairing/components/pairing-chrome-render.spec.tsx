import { act, cleanup, render, screen } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PairingChrome } from './pairing-chrome';

/**
 * The pairing chrome's render budget: a second passing moves the countdown
 * and nothing else.
 *
 * The tick lives in `TokenCountdown`: handed down as `secondsLeft`, it would
 * re-render the whole surface above it (the Add host dialog, the onboarding
 * step, both code blocks) every second it was open. Runs without the React
 * Compiler.
 */

// Partial: the forms concern's index also loads the i18n instance, which
// needs the real `initReactI18next`.
vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (key: string, options?: { time?: string }) =>
      options?.time === undefined ? key : `${key} ${options.time}`,
  }),
}));

/** The clock the countdown reads, driven by the test. */
const clock = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  let now = 0;
  return {
    get: () => now,
    set(next: number) {
      now = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

/** Renders of the status row, the chrome's other half. */
const statusRenders = vi.hoisted(() => ({ count: 0 }));

vi.mock('@oppenheimer/design-system-web', async (original) => ({
  ...(await original<typeof import('@oppenheimer/design-system-web')>()),
  useNow: () => useSyncExternalStore(clock.subscribe, clock.get),
  StatusDot: ({ children }: { children?: React.ReactNode }) => {
    statusRenders.count += 1;
    return <span>{children}</span>;
  },
}));

afterEach(cleanup);

const START = Date.parse('2026-09-26T10:00:00Z');

describe('PairingChrome', () => {
  it('moves the countdown on a tick and renders nothing else', () => {
    clock.set(START);
    render(
      <PairingChrome
        pairing={{ installCommand: 'curl …', agentPrompt: 'Install …' }}
        expiresAt={new Date(START + 10 * 60_000)}
        expired={false}
        onRegenerate={() => {}}
        host={null}
      />,
    );
    expect(screen.getByText('hosts.pairing.tokenExpires 10:00')).toBeDefined();
    statusRenders.count = 0;

    act(() => clock.set(START + 1000));

    expect(screen.getByText('hosts.pairing.tokenExpires 9:59')).toBeDefined();
    expect(statusRenders.count).toBe(0);
  });
});
