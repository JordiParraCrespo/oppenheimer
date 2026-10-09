import { Button, Callout, Skeleton, StepHeader } from '@oppenheimer/design-system-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useHostsAvailability } from '../hooks/use-hosts-availability';
import { OnboardingHostPairing } from '../sections/onboarding-host-pairing';

/**
 * Onboarding: pair the first host (`design/version1/AddHost.dc.html`, the
 * 2026-09-27 export). This step owns the header and asks the deployment first
 * whether it can pair at all. Where it can, the pairing column mints and waits
 * (`OnboardingHostPairing`). Where it cannot (no runner releases configured,
 * `hosts` off), nothing is minted: every mint would answer `HOSTS_004`, which
 * used to leave a red error over "Waiting for the host…" forever. The step
 * says so calmly and makes Skip the way on.
 */
export function OnboardingHostScreen({
  step,
  total,
  back,
  next,
  skip,
}: {
  step: number;
  total: number;
  back: ReactElement;
  next: (hostId: string | undefined) => ReactElement;
  /** Skip's link; the primary action on a deployment that cannot pair a machine yet. */
  skip: ReactElement;
}) {
  const { t } = useTranslation();
  const availability = useHostsAvailability();

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={step}
        total={total}
        back={{ render: back }}
        backLabel={t('onboarding.flow.back')}
        counterLabel={t('onboarding.flow.step', { step, total })}
        title={t('onboarding.flow.host.title')}
      >
        {t('onboarding.flow.host.description')}
      </StepHeader>

      {availability === 'available' ? (
        <OnboardingHostPairing next={next} skip={skip} />
      ) : availability === 'unavailable' ? (
        <div className="flex flex-col items-start gap-3.5">
          <Callout>{t('hosts.pairing.unavailable')}</Callout>
          <Button size="lg" render={skip}>
            {t('onboarding.flow.host.skip')}
          </Button>
          <p className="text-xs leading-normal text-fg-subtle">
            {t('onboarding.flow.host.skipNote')}
          </p>
        </div>
      ) : (
        <Skeleton className="h-40 w-full" />
      )}
    </div>
  );
}
