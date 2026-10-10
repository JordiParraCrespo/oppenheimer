import { Callout, Skeleton } from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostsAvailability } from '../hooks/use-hosts-availability';

/**
 * The pairing part of a pairing surface, by whether this deployment can pair
 * (`usePairing`'s `availability`): a placeholder while that is being asked,
 * the explanation when it cannot, and the surface's own pairing UI when it
 * can. The surface's header and its way out stay outside, in every state.
 */
export function PairingGate({
  availability,
  children,
}: {
  availability: HostsAvailability;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  if (availability === 'checking') return <Skeleton className="h-40 w-full" />;
  if (availability === 'unavailable') return <Callout>{t('hosts.pairing.unavailable')}</Callout>;
  return children;
}
