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
import { ErrorAlert, installUrlCarryingWalk } from '@oppenheimer/frontend-web';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { InstallationCard } from '@/features/installations/components/installation-card';
import { useConnectInstallationCallback } from '@/features/installations/hooks/use-connect-installation-callback';

/**
 * Onboarding step 3: install the GitHub App. One primary button that sends the
 * browser to GitHub; once the installation exists it becomes a card naming the
 * account and how many repositories it covers, with Continue below. Skippable:
 * the repo picker stays empty until it is done.
 *
 * The button is a plain link out, not a mutation — the install happens on
 * GitHub. What comes back is `installation_id` and `code` on the query string,
 * which the hook below exchanges once for the installation row.
 */
export function OnboardingGithubScreen({
  githubInstallationId,
  code,
  walk,
  back,
  next,
}: {
  /** GitHub's numeric installation id (not our row's UUID), present only on the return leg. */
  githubInstallationId?: number;
  /** The one-shot code from the same redirect. */
  code?: string;
  /**
   * Set when this visit is the first-run walk: pinned on the install URL, so
   * it survives the round trip through GitHub, and put back on the return leg.
   */
  walk?: true;
  /** The previous step, as a link element the header's back renders. */
  back: ReactElement;
  /**
   * The step after this one, as a link element: with the connected
   * installation's id (Continue), without it (Skip). The route builds it,
   * because the route knows the flow.
   */
  next: (installationId?: string) => ReactElement;
}) {
  const { t } = useTranslation();
  // Where the browser goes to install, as the deployment reports it. An
  // unreachable read leaves it undefined, which renders a disabled offer
  // rather than a link to a page that may not exist.
  const { data: deployment } = useDeploymentCapabilities();
  const address = deployment?.github_app_install_url ?? undefined;
  // Leaving for GitHub loses the query this step was opened with, so a walk
  // travels as `state` and comes back under that name. A reader New session
  // sent here is not walking and pins nothing.
  const installUrl = address && walk ? installUrlCarryingWalk(address) : address;

  const {
    isExchanging,
    connected,
    error: connectError,
  } = useConnectInstallationCallback(githubInstallationId, code, walk);
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
  const error = connectError ?? listError;

  return (
    <div className="flex flex-col gap-5">
      <StepHeader
        step={3}
        total={4}
        back={{ render: back }}
        backLabel={t('onboarding.flow.back')}
        title={t('onboarding.flow.github.title')}
      >
        {t('onboarding.flow.github.description')}
      </StepHeader>

      <ErrorAlert error={error} fallback={t('onboarding.flow.github.failed')} />

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
          <Button size="lg" block render={next(installation.id)}>
            {t('onboarding.flow.continue')}
          </Button>
          {installUrl && (
            <TextLink className="self-start text-sm" render={<a href={installUrl} />}>
              {t('onboarding.flow.github.change')}
            </TextLink>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* No slug configured means no install page to send anyone to, so the
              offer is disabled rather than pointing at a GitHub 404. */}
          <Button size="lg" block disabled={!installUrl} render={<a href={installUrl ?? '#'} />}>
            {t('onboarding.flow.github.connect')}
          </Button>
          <div className="flex flex-col items-start gap-1.5">
            <TextLink render={next()}>{t('onboarding.flow.github.skip')}</TextLink>
            <p className="text-xs leading-normal text-fg-subtle">
              {t('onboarding.flow.github.skipNote')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
