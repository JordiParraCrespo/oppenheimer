import { Callout } from '@oppenheimer/design-system-web';
import { LoadingStatus } from '@oppenheimer/frontend-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostsAvailability } from '../hooks/use-hosts-availability';

/**
 * The pairing part of a pairing surface, by whether this deployment can pair
 * (`usePairing`'s `availability`): the explanation when it cannot, and the
 * surface's own pairing UI otherwise. While that is being asked the UI is
 * drawn already, with no token minted yet (`usePairing` mints only once it is
 * `available`), so its own placeholders hold the steps' shape and its actions
 * wait, disabled, rather than a grey block standing in for all of it. The
 * surface's header and its way out stay outside, in every state.
 */
export function PairingGate({
  availability,
  children,
}: {
  availability: HostsAvailability;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  if (availability === 'unavailable') return <Callout>{t('hosts.pairing.unavailable')}</Callout>;
  const checking = availability === 'checking';
  return (
    <div aria-busy={checking || undefined} className="contents">
      {checking && <LoadingStatus />}
      {children}
    </div>
  );
}
