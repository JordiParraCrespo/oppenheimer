import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddHostDialog } from '../dialogs/add-host';
import { OnboardingHostScreen } from '../screens/onboarding-host';

/**
 * A pairing surface asks the deployment before it mints. Every mint on a
 * server with no runner releases configured answers `HOSTS_004`, and the host
 * step used to mint on mount anyway: a red error, greyed copy buttons and
 * "Waiting for the host…" forever. What breaks this is mounting the pairing
 * flow (`useHostPairing`, whose query is the mint) before reading `hosts`.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const deployment = vi.hoisted(() => ({
  current: { data: undefined as boolean | undefined, isPending: true },
}));

vi.mock('@oppenheimer/frontend-core/react', async (original) => ({
  ...(await original<typeof import('@oppenheimer/frontend-core/react')>()),
  useDeploymentCapabilities: () => deployment.current,
}));

/** The pairing flow; calling it is what mints a token. */
const useHostPairing = vi.hoisted(() =>
  vi.fn(() => ({
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
  PairingChrome: () => <div data-testid="pairing-chrome" />,
}));

afterEach(() => {
  cleanup();
  useHostPairing.mockClear();
});

function hostsCapability(hosts: boolean | undefined, isPending = false) {
  deployment.current = { data: hosts, isPending };
}

/** The route's links, as a plain anchor the step's own children fill. */
function To(props: ComponentProps<'a'>) {
  return <a {...props} />;
}

function renderStep() {
  render(
    <OnboardingHostScreen
      step={4}
      total={4}
      back={<To href="/onboarding/github" />}
      next={() => <To href="/onboarding/ready" />}
      skip={<To href="/onboarding/ready?skipped" />}
    />,
  );
}

describe('the onboarding host step', () => {
  it('mints no token, explains, and offers Skip when the deployment cannot pair', () => {
    hostsCapability(false);
    renderStep();

    expect(useHostPairing).not.toHaveBeenCalled();
    expect(screen.getByText('hosts.pairing.unavailable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'onboarding.flow.host.skip' })).toBeTruthy();
    expect(screen.queryByText('onboarding.flow.continue')).toBeNull();
    expect(screen.queryByTestId('pairing-chrome')).toBeNull();
  });

  it('mints nothing while it is still asking the deployment', () => {
    hostsCapability(undefined, true);
    renderStep();

    expect(useHostPairing).not.toHaveBeenCalled();
  });

  it('pairs as before on a deployment that can', () => {
    hostsCapability(true);
    renderStep();

    expect(useHostPairing).toHaveBeenCalled();
    expect(screen.getByTestId('pairing-chrome')).toBeTruthy();
    expect(screen.queryByText('hosts.pairing.unavailable')).toBeNull();
  });

  it('still pairs when the capabilities read failed, which is not a "no"', () => {
    hostsCapability(undefined, false);
    renderStep();

    expect(useHostPairing).toHaveBeenCalled();
  });
});

describe('the Add a host dialog', () => {
  it('mints no token and explains when the deployment cannot pair', () => {
    hostsCapability(false);
    render(<AddHostDialog onClose={() => {}} onUseHost={() => {}} />);

    expect(useHostPairing).not.toHaveBeenCalled();
    expect(screen.getByText('hosts.pairing.unavailable')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'hosts.add.use' })).toBeNull();
  });
});
