import { Button, Link as TextLink } from '@oppenheimer/design-system-web';
import { PairingChrome } from '@oppenheimer/frontend-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';

/**
 * Onboarding's pairing column: the kit's `PairingChrome`, shared with the
 * console's Add a host dialog, Continue, and Skip. Mounting it mints the token,
 * so the step mounts it only on a deployment that can pair
 * (`useHostsAvailability`). Continue waits for the runner to come online
 * (`usePairing`'s rules).
 */
export function OnboardingHostPairing({
  next,
  skip,
}: {
  next: (hostId: string | undefined) => ReactElement;
  skip: ReactElement;
}) {
  const { t } = useTranslation();
  // Online, not merely registered: the row appears when the runner registers,
  // and its service may still be starting (`usePairing`'s rules).
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('onboarding.flow.host.defaultName'),
    'online',
  );

  return (
    <>
      <PairingChrome
        pairing={pairing ?? null}
        expiresAt={expiresAt}
        expired={expired}
        onRegenerate={regenerate}
        busy={isPending}
        host={host}
        error={error}
        layout="step"
      />

      <div className="flex flex-col items-start gap-3.5">
        <Button size="lg" disabled={!done} render={next(host?.id)}>
          {t('onboarding.flow.continue')}
        </Button>

        {/* Skippable even where pairing works: a machine may not be at hand,
            and it is what makes Ready's "no host yet" row reachable. */}
        <div className="flex flex-col items-start gap-1.5">
          <TextLink render={skip}>{t('onboarding.flow.host.skip')}</TextLink>
          <p className="text-xs leading-normal text-fg-subtle">
            {t('onboarding.flow.host.skipNote')}
          </p>
        </div>
      </div>
    </>
  );
}
