import { Button, StepHeader, Link as TextLink } from '@oppenheimer/design-system-web';
import { PairingChrome } from '@oppenheimer/frontend-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { usePairing } from '../hooks/use-pairing';

/**
 * Onboarding: pair the first host (`design/version1/AddHost.dc.html`,
 * the 2026-09-27 export). One sentence — run one command on the machine —
 * then the two copy buttons at the large size, the token line, the command
 * and the prompt folded behind Inspect command and prompt, a rule, and the
 * status line that resolves in place when the runner registers. Continue
 * waits for that.
 *
 * What is this step's is the header and that wait. The column under it —
 * the buttons, the token line, the fold, the status row — is the kit's
 * `PairingChrome`, which the console's Add a host dialog draws too at
 * its smaller size, and the flow under both is `usePairing`.
 *
 * Both forms come from the API with the secret already in them: it is shown
 * once, and the server is the only place that knows it, so neither string is
 * assembled here.
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
  const { pairing, expiresAt, expired, host, isPending, error, regenerate, done } = usePairing(
    t('onboarding.flow.host.defaultName'),
    'online',
  );

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={step}
        total={total}
        back={{ render: back }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.host.title')}
      >
        {t('onboarding.flow.host.description')}
      </StepHeader>

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

        {/* The step is skippable for the same reason Connect GitHub is: a
            deployment with no runner release configured answers HOSTS_004 to
            every mint, and without a way past this the first-run flow every
            sign-up now walks would have no exit. It is also what makes Ready's
            "no host yet" row reachable. */}
        <div className="flex flex-col items-start gap-1.5">
          <TextLink render={skip}>{t('onboarding.flow.host.skip')}</TextLink>
          <p className="text-xs leading-normal text-fg-subtle">
            {t('onboarding.flow.host.skipNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
