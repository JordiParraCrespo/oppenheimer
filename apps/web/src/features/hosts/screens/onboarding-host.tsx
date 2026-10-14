import { Button, StepHeader, Link as TextLink } from '@oppenheimer/design-system-web';
import { PairingChrome } from '@oppenheimer/frontend-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { PairingGate } from '../components/pairing-gate';
import { usePairing } from '../hooks/use-pairing';

/**
 * Onboarding: pair the first host (`design/version1/AddHost.dc.html`, the
 * 2026-10-13 export): the agent prompt first, the command behind "Install
 * manually instead", the Connection list under them. This step owns the
 * header and the wait: Continue waits for the runner to come online
 * (`usePairing`'s rules). The column is the kit's `PairingChrome`, shared
 * with the console's Add a host dialog.
 *
 * Skip for now sits beside Continue in every state, the answer about pairing
 * still on its way included. Where this deployment cannot pair, it is the
 * primary action and Continue goes.
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
  /** Skip's link, for a deployment that cannot pair a machine yet. */
  skip: ReactElement;
}) {
  const { t } = useTranslation();
  // Online, not merely registered: the row appears when the runner registers,
  // and its service may still be starting (`usePairing`'s rules).
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done, availability } =
    usePairing(t('onboarding.flow.host.defaultName'), 'online');
  const unavailable = availability === 'unavailable';

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

      <PairingGate availability={availability}>
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
      </PairingGate>

      {/* Skippable even where pairing works: a machine may not be at hand,
          and it is what makes Ready's "no host yet" row reachable. */}
      <div className="flex flex-wrap items-center gap-4">
        {unavailable ? (
          <Button size="lg" render={skip}>
            {t('onboarding.flow.host.skip')}
          </Button>
        ) : (
          <>
            <Button size="lg" disabled={!done} render={next(host?.id)}>
              {t('onboarding.flow.continue')}
            </Button>
            <TextLink className="text-sm" render={skip}>
              {t('onboarding.flow.host.skip')}
            </TextLink>
          </>
        )}
        <p className="text-xs leading-normal text-pretty text-fg-subtle">
          {t('onboarding.flow.host.skipNote')}
        </p>
      </div>
    </div>
  );
}
