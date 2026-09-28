import {
  Button,
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
import { AuthLink, ErrorAlert } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InstallationCard } from '@/features/organizations/components/installation-card';
import { useConnectInstallationCallback } from '@/features/organizations/hooks/use-connect-installation-callback';
import { useStartGithubInstall } from '@/features/organizations/hooks/use-start-github-install';

/**
 * Onboarding step 3: install the GitHub App. One primary button that sends the
 * browser to GitHub; once the installation exists it becomes a card naming the
 * account and how many repositories it covers, with Continue below. Skippable:
 * the repo picker stays empty until it is done.
 *
 * The button mints the install state first, then leaves for GitHub with it —
 * the install happens there. What comes back is `installation_id`, `code` and
 * that `state` on the query string, which the hook below exchanges once for
 * the installation row. A callback without a state was not started here, and
 * is refused on screen rather than posted.
 */
export function OnboardingGithubScreen({
  githubInstallationId,
  code,
  state,
  walk,
}: {
  /** GitHub's numeric installation id (not our row's UUID), present only on the return leg. */
  githubInstallationId?: number;
  /** The one-shot code from the same redirect. */
  code?: string;
  /** The install state GitHub echoed, nonce only. */
  state?: string;
  /** Set when this visit is the first-run walk, and handed on to the next step. */
  walk?: true;
}) {
  const { t } = useTranslation();
  // Whether there is an App to install, as the deployment reports it. An
  // unreachable read leaves it undefined, which renders a disabled offer
  // rather than a button to a page that may not exist. Where the browser goes
  // is minted on click, with the state; a walk rides along as its prefix.
  const { data: deployment } = useDeploymentCapabilities();
  const canInstall = Boolean(deployment?.github_app_install_url);
  const { start, isStarting, error: startError } = useStartGithubInstall(walk);

  const {
    isExchanging,
    connected,
    unstarted,
    error: connectError,
  } = useConnectInstallationCallback(githubInstallationId, code, state, walk);
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
        step={3}
        total={4}
        back={{ render: <Link to="/onboarding/workspace" /> }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.github.title')}
      >
        {t('onboarding.flow.github.description')}
      </StepHeader>

      <ErrorAlert error={error} fallback={t('onboarding.flow.github.failed')} />
      <ErrorAlert message={unstarted ? t('onboarding.flow.github.unstarted') : null} />

      {isPending || isExchanging ? (
        <Card className="flex-row items-center gap-3 px-[18px] py-4">
          <Skeleton className="size-7 shrink-0 rounded-pill" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </span>
        </Card>
      ) : installation ? (
        <div className="flex flex-col gap-5">
          <InstallationCard installation={installation} repositoryCount={repositories?.length} />
          <Button
            size="lg"
            block
            render={<Link to="/onboarding/host" search={{ installation: installation.id, walk }} />}
          >
            {t('onboarding.flow.continue')}
          </Button>
          {canInstall && (
            <TextLink
              className="self-start text-sm"
              render={<button type="button" onClick={start} disabled={isStarting} />}
            >
              {t('onboarding.flow.github.change')}
            </TextLink>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* No slug configured means no install page to send anyone to, so the
              offer is disabled rather than pointing at a GitHub 404. */}
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
            <AuthLink to="/onboarding/host" search={{ walk }}>
              {t('onboarding.flow.github.skip')}
            </AuthLink>
            <p className="text-xs leading-normal text-fg-subtle">
              {t('onboarding.flow.github.skipNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
