import {
  Button,
  Card,
  CodeBlock,
  StatusDot,
  StepHeader,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { usePairingToken } from '@/features/hosts/hooks/use-pairing-token';

const INSTALL_URL = 'https://app.oppenheimer.dev/install.sh';

/**
 * Onboarding step 4: pair the first host. The same one-hour token in two
 * forms, the install command and a prompt for an agent already running on the
 * machine, then a status line that resolves in place when the runner
 * registers. Continue waits for that.
 *
 * Scaffold: the token is fixed, the clock and the registration are timers.
 */
export function OnboardingHostScreen() {
  const { t } = useTranslation();
  const { token, countdown, host, regenerate } = usePairingToken();

  const command = `curl -fsSL ${INSTALL_URL} | sh -s -- --token ${token}`;
  const prompt = [
    'Install the oppenheimer runner on this machine.',
    `Run: ${command}`,
    'Then confirm the service is running with: oppenheimer-runner status',
    'Report the hostname and OS version back to me.',
  ].join('\n');

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card padded>
          <CodeBlock title={t('onboarding.flow.host.installCommand')} code={command} />
        </Card>
        <Card padded>
          <CodeBlock
            title={t('onboarding.flow.host.agentPrompt')}
            code={prompt}
            dim={`| sh -s -- --token ${token}\nThen confirm the service is running with: oppenheimer-runner status\nReport the hostname and OS version back to me.`}
            note={t('onboarding.flow.host.agentNote')}
          />
        </Card>
      </div>

      <div className="flex flex-wrap items-baseline gap-3">
        <span className="figures text-xs whitespace-nowrap text-fg-muted">
          {t('onboarding.flow.host.tokenExpires', { time: countdown })}
        </span>
        <TextLink className="text-xs" render={<button type="button" onClick={regenerate} />}>
          {t('onboarding.flow.host.newToken')}
        </TextLink>
      </div>

      <div className="h-px bg-border-subtle" />

      <div className="flex min-h-[52px] flex-col justify-center">
        {host ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusDot state="running">
              <span className="figures text-[13px]">{host.name}</span>
            </StatusDot>
            <span className="text-xs text-fg-muted">{host.meta}</span>
            <span className="flex-1" />
            <span className="text-xs text-fg-muted">{t('onboarding.flow.host.ready')}</span>
          </div>
        ) : (
          <StatusDot state="pending" pulse>
            {t('onboarding.flow.host.waiting')}
          </StatusDot>
        )}
      </div>

      <div>
        <Button size="lg" disabled={!host} render={<Link to="/onboarding/ready" />}>
          {t('onboarding.flow.continue')}
        </Button>
      </div>
    </div>
  );
}
