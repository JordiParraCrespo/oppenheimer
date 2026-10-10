import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddHostDialog } from '../dialogs/add-host';
import { AddHostScreen } from '../screens/add-host';
import { OnboardingHostScreen } from '../screens/onboarding-host';

/**
 * Every pairing surface mints only once the deployment has said it can pair
 * (`hosts` on `GET /health/capabilities`). What breaks this is running the
 * pairing flow enabled (`useHostPairing`, whose query is the mint) before that
 * answer, or despite a `false`.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const deployment = vi.hoisted(() => ({
  current: { data: undefined as boolean | undefined, isFetchedAfterMount: false },
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useDeploymentCapabilities: () => deployment.current,
}));

/** The pairing flow; running it enabled is what mints a token. */
const useHostPairing = vi.hoisted(() =>
  vi.fn((_name: string, _options?: { enabled?: boolean }) => ({
    pairing: undefined,
    expiresAt: null,
    expired: false,
    host: null,
    isPending: true,
    error: null,
    regenerate: () => {},
  })),
);

vi.mock('@oppenheimer/frontend-consumer/react', () => ({ useHostPairing }));

vi.mock('@oppenheimer/frontend-web', () => ({
  PairingChrome: () => <div data-testid="pairing" />,
  PairingInstruction: () => <div data-testid="pairing" />,
  PairingToken: () => null,
  PairingStatus: () => null,
  ErrorAlert: () => null,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children?: ReactNode }) => <a href="/settings/hosts">{children}</a>,
  useNavigate: () => () => {},
}));

afterEach(() => {
  cleanup();
  useHostPairing.mockClear();
});

const minted = () => useHostPairing.mock.calls.some(([, options]) => options?.enabled !== false);

/** The route's links, as a plain anchor the step's own children fill. */
function To(props: ComponentProps<'a'>) {
  return <a {...props} />;
}

const surfaces = {
  'the onboarding host step': () => (
    <OnboardingHostScreen
      step={4}
      total={4}
      back={<To href="/onboarding/github" />}
      next={() => <To href="/onboarding/ready" />}
      skip={<To href="/onboarding/ready?skipped" />}
    />
  ),
  'the Add a host dialog': () => <AddHostDialog onClose={() => {}} onUseHost={() => {}} />,
  'Settings → Add a host': () => <AddHostScreen />,
};

const states = [
  { name: 'cannot pair', data: false, fetched: true, mints: false },
  { name: 'is still being asked', data: undefined, fetched: false, mints: false },
  {
    name: 'answered from a cache this mount has not refreshed',
    data: true,
    fetched: false,
    mints: false,
  },
  { name: 'can pair', data: true, fetched: true, mints: true },
  { name: 'could not be read (which is not a "no")', data: undefined, fetched: true, mints: true },
];

describe.each(Object.entries(surfaces))('%s', (_, surface) => {
  it.each(states)('when the deployment $name, mints: $mints', ({ data, fetched, mints }) => {
    deployment.current = { data, isFetchedAfterMount: fetched };
    render(surface());

    expect(minted()).toBe(mints);
    expect(screen.queryAllByTestId('pairing').length > 0).toBe(mints);
    expect(screen.queryByText('hosts.pairing.unavailable') !== null).toBe(data === false);
  });
});

describe('the onboarding host step', () => {
  function renderStep(data: boolean | undefined, fetched: boolean) {
    deployment.current = { data, isFetchedAfterMount: fetched };
    render(surfaces['the onboarding host step']());
  }

  it('keeps Skip while it is still asking, so a slow answer is never a dead end', () => {
    renderStep(undefined, false);

    expect(screen.getByRole('link', { name: 'onboarding.flow.host.skip' })).toBeTruthy();
  });

  it('makes Skip the way on, without Continue, when the deployment cannot pair', () => {
    renderStep(false, true);

    expect(screen.getByRole('link', { name: 'onboarding.flow.host.skip' })).toBeTruthy();
    expect(screen.queryByText('onboarding.flow.continue')).toBeNull();
  });
});

describe('the Add a host dialog', () => {
  it('offers only Close when the deployment cannot pair', () => {
    deployment.current = { data: false, isFetchedAfterMount: true };
    render(surfaces['the Add a host dialog']());

    expect(screen.queryByRole('button', { name: 'hosts.add.use' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'common.close' }).length).toBeGreaterThan(0);
  });
});
