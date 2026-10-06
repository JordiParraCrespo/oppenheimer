import {
  Button,
  Callout,
  Card,
  Skeleton,
  StepHeader,
  Link as TextLink,
} from '@oppenheimer/design-system-web';
import {
  useInstallationRepositories,
  useInstallations,
} from '@oppenheimer/frontend-consumer/react';
import { useDeploymentCapabilities } from '@oppenheimer/frontend-core/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { InstallationCard } from '@/features/installations/components/installation-card';
import { useConnectInstallationCallback } from '@/features/installations/hooks/use-connect-installation-callback';
import { useStartGithubInstall } from '@/features/installations/hooks/use-start-github-install';

/**
 * Onboarding step 3: install the GitHub App. Skippable; the repo picker stays
 * empty until it is done. The button mints the install state before leaving
 * for GitHub, and `useConnectInstallationCallback` exchanges what comes back;
 * a callback without a state is refused on screen rather than posted.
 *
 * A member who is not an owner of the organization they picked can only
 * *request* the install: GitHub comes back with `setup_action=request` and no
 * installation, and the approval later goes to the owner. The screen says so
 * instead of looking as if nothing happened; once approved, Connect GitHub
 * again reaches the installation (the App's "Redirect on update" sends the
 * picker back here with it).
 */
export function OnboardingGithubScreen({
  githubInstallationId,
  code,
  state,
  requested,
  installUrlFor,
  onExchanged,
  step,
  total,
  back,
  next,
  skip,
}: {
  /** GitHub's numeric installation id (not our row's UUID), present only on the return leg. */
  githubInstallationId?: number;
  /** The one-shot code from the same redirect. */
  code?: string;
  /** The install state GitHub echoed, nonce only. */
  state?: string;
  /** GitHub came back with `setup_action=request`: an owner has to approve the install. */
  requested?: boolean;
  /**
   * The minted install URL as this visit should use it. The route pins what
   * must survive the round trip through github.com; this screen only sends the
   * reader there.
   */
  installUrlFor: (installUrl: string) => string;
  /** The code was exchanged: the route clears the spent callback from its URL. */
  onExchanged: () => void;
  step: number;
  total: number;
  back: ReactElement;
  next: (installationId: string) => ReactElement;
  skip: ReactElement;
}) {
  const { t } = useTranslation();
  // Whether there is an App to install, as the deployment reports it. With
  // none configured, or an unreachable read, the offer is disabled rather than
  // pointing at a GitHub 404. Where the browser goes is minted on click, with
  // the state.
  const { data: deployment } = useDeploymentCapabilities();
  const canInstall = Boolean(deployment?.github_app_install_url);
  const { start, isStarting, error: startError } = useStartGithubInstall(installUrlFor);

  const {
    isExchanging,
    connected,
    unstarted,
    error: connectError,
  } = useConnectInstallationCallback(githubInstallationId, code, state, onExchanged);
  const { data: installations, isPending, error: listError } = useInstallations();

  // The installation this visit connected, when there was one — the callback
  // knows which row it just wrote. Falling back to the list covers the reader
  // who installed on a previous visit and came back; matching on
  // `githubInstallationId` rather than taking the first row means an account
  // with more than one connection still sees the one it just made.
  const installation =
    (connected && installations?.find((row) => row.id === connected.id)) ??
    connected ??
    installations?.find((row) => row.githubInstallationId === githubInstallationId) ??
    installations?.[0];
  // The card shows the count, but a `components/` file never fetches, so the
  // screen that renders it asks. Skipped entirely for an installation that
  // covers the whole account, which has no number to show.
  const { data: repositories } = useInstallationRepositories(
    installation && !installation.coversEveryRepository ? installation.id : undefined,
  );
  const error = startError ?? connectError ?? listError;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={step}
        total={total}
        back={{ render: back }}
        backLabel={t('onboarding.flow.back')}
        counterLabel={t('onboarding.flow.step', { step, total })}
        title={t('onboarding.flow.github.title')}
      >
        {t('onboarding.flow.github.description')}
      </StepHeader>

      <ErrorAlert error={error} fallback={t('onboarding.flow.github.failed')} />
      <ErrorAlert message={unstarted ? t('onboarding.flow.github.unstarted') : null} />
      {requested ? <Callout tone="info">{t('onboarding.flow.github.requested')}</Callout> : null}

      {isPending || isExchanging ? (
        <Card>
          <div className="flex items-center gap-3 px-4.5 py-4">
            <Skeleton shape="pill" className="size-7 shrink-0" />
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-20" />
            </span>
          </div>
        </Card>
      ) : installation ? (
        <div className="flex flex-col gap-5">
          <InstallationCard installation={installation} repositoryCount={repositories?.length} />
          <Button size="lg" block render={next(installation.id)}>
            {t('onboarding.flow.continue')}
          </Button>
          {canInstall && (
            <span className="self-start text-sm">
              <TextLink render={<button type="button" onClick={start} disabled={isStarting} />}>
                {t('onboarding.flow.github.change')}
              </TextLink>
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <Button
            size="lg"
            block
            disabled={!canInstall}
            pending={isStarting}
            pendingLabel={t('onboarding.flow.github.starting')}
            onClick={start}
          >
            {t('onboarding.flow.github.connect')}
          </Button>
          <div className="flex flex-col items-start gap-1.5">
            <TextLink render={skip}>{t('onboarding.flow.github.skip')}</TextLink>
            <p className="text-xs leading-normal text-fg-subtle">
              {t('onboarding.flow.github.skipNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
