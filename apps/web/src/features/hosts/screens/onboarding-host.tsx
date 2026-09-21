import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CodeBlock,
  Skeleton,
  StatusDot,
  StepHeader,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { AuthLink } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePairingToken } from '@/features/hosts/hooks/use-pairing-token';

/** How much of either block is shown before it scrolls; the rest is one copy away. */
const CODE_MAX_LINES = 12;

/**
 * Onboarding step 4: pair the first host. The same registration token in two
 * forms — the install command and a prompt for an agent already running on the
 * machine — then a status line that resolves in place when the runner
 * registers. Continue waits for that.
 *
 * Both forms come from the API with the secret already in them: it is shown
 * once, and the server is the only place that knows it, so neither string is
 * assembled here.
 */
export function OnboardingHostScreen({
  installationId,
}: {
  /** What Connect GitHub connected, passed through so Ready can name it. */
  installationId?: string;
}) {
  const { t } = useTranslation();
  const resolveError = useErrorMessage();
  const { pairing, countdown, expired, host, isPending, error, regenerate } = usePairingToken(
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
            {resolveError(error, t('onboarding.flow.host.mintFailed')).message}
          </AlertDescription>
        </Alert>
      )}

      {/* Both blocks are capped to the same number of lines so the two cards
          stay the same height: the agent prompt the server composes runs to
          thirty-odd lines, and uncapped it stretched the pair down the page. */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card padded>
          {pairing ? (
            <CodeBlock
              title={t('onboarding.flow.host.installCommand')}
              code={pairing.installCommand}
              maxLines={CODE_MAX_LINES}
              copyLabel={t('common.copy')}
              copiedLabel={t('common.copied')}
            />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
        <Card padded>
          {pairing ? (
            <CodeBlock
              title={t('onboarding.flow.host.agentPrompt')}
              code={pairing.agentPrompt}
              maxLines={CODE_MAX_LINES}
              note={t('onboarding.flow.host.agentNote')}
              copyLabel={t('common.copy')}
              copiedLabel={t('common.copied')}
            />
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <span className="figures text-xs whitespace-nowrap text-fg-muted">
          {/* An expired token can pair nothing, so the line says so rather
              than counting down through zero. */}
          {expired
            ? t('onboarding.flow.host.tokenExpired')
            : t('onboarding.flow.host.tokenExpires', { time: countdown })}
        </span>
        <TextLink
          className="text-xs"
          render={<button type="button" onClick={regenerate} disabled={isPending} />}
        >
          {t('onboarding.flow.host.newToken')}
        </TextLink>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex min-h-[52px] flex-col justify-center">
        {host ? (
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Registered is not the same as dialled in: the installer can
                finish, and the service still be starting. The dot follows what
                the API reports rather than the fact a row appeared, or a host
                whose runner never came up would read as running. */}
            <StatusDot state={host.online ? 'running' : 'idle'}>
              <span className="figures text-[13px]">{host.name}</span>
            </StatusDot>
            {host.os && <span className="text-xs text-fg-muted">{host.os}</span>}
            <span className="flex-1" />
            <span className="text-xs text-fg-muted">
              {host.online ? t('onboarding.flow.host.ready') : t('onboarding.flow.host.registered')}
            </span>
          </div>
        ) : (
          <StatusDot state="pending" pulse>
            {t('onboarding.flow.host.waiting')}
          </StatusDot>
        )}
      </div>

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
              search={{ installation: installationId, host: host?.id }}
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
          <AuthLink to="/onboarding/ready" search={{ installation: installationId }}>
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
