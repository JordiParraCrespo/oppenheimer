import { Alert, AlertDescription, Button, StepHeader } from '@oppenheimer/design-system-web';
import { useHostPairing } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { AuthLink, HostPairingChrome } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

/**
 * Onboarding step 4: pair the first host (`design/version1/AddHost.dc.html`,
 * the 2026-09-27 export). One sentence — run one command on the machine —
 * then the two copy buttons at the large size, the token line, the command
 * and the prompt folded behind Inspect command and prompt, a rule, and the
 * status line that resolves in place when the runner registers. Continue
 * waits for that.
 *
 * What is this step's is the header and that wait. The column under it —
 * the buttons, the token line, the fold, the status row — is the kit's
 * `HostPairingChrome`, which the console's Add a host dialog draws too at
 * its smaller size, and the flow under both is `useHostPairing`.
 *
 * Both forms come from the API with the secret already in them: it is shown
 * once, and the server is the only place that knows it, so neither string is
 * assembled here.
 */
export function OnboardingHostScreen({
  installationId,
  walk,
}: {
  /** What Connect GitHub connected, passed through so Ready can name it. */
  installationId?: string;
  /**
   * Set when this visit is the first-run walk — which, since Add host pairs a
   * machine from the console, is the only way to be on this step at all. It is
   * handed on to Ready, which asks the same question
   * (`organizations/lib/first-run.ts`).
   */
  walk?: true;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { pairing, expiresAt, expired, host, isPending, error, regenerate } = useHostPairing(
    t('onboarding.flow.host.defaultName'),
  );

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={4}
        total={4}
        back={{ render: <Link to="/onboarding/github" /> }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.host.title')}
      >
        {t('onboarding.flow.host.description')}
      </StepHeader>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {resolveError(error, t('hosts.pairing.mintFailed')).message}
          </AlertDescription>
        </Alert>
      )}

      <HostPairingChrome
        pairing={pairing ?? null}
        expiresAt={expiresAt}
        expired={expired}
        onRegenerate={regenerate}
        busy={isPending}
        host={host}
        layout="step"
      />

      <div className="flex flex-col items-start gap-3.5">
        {/* Online, not merely registered: the row appears when the runner
            registers, and its service may still be starting. Continuing on a
            host that never came up is onboarding claiming a machine the
            console cannot use. */}
        <Button
          size="lg"
          disabled={!host?.online}
          render={
            <Link
              to="/onboarding/ready"
              search={{ installation: installationId, host: host?.id, walk }}
            />
          }
        >
          {t('onboarding.flow.continue')}
        </Button>

        {/* The step is skippable for the same reason Connect GitHub is: a
            deployment with no runner release configured answers HOSTS_004 to
            every mint, and without a way past this the first-run flow every
            sign-up now walks would have no exit. It is also what makes Ready's
            "no host yet" row reachable. */}
        <div className="flex flex-col items-start gap-1.5">
          <AuthLink to="/onboarding/ready" search={{ installation: installationId, walk }}>
            {t('onboarding.flow.host.skip')}
          </AuthLink>
          <p className="text-xs leading-normal text-fg-subtle">
            {t('onboarding.flow.host.skipNote')}
          </p>
        </div>
      </div>
    </div>
  );
}
