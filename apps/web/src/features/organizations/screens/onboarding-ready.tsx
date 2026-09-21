import {
  Button,
  Skeleton,
  StepHeader,
  SuccessMark,
  SummaryCard,
  SummaryRow,
} from '@oppenheimer/design-system-web';
import {
  useHosts,
  useInstallationRepositories,
  useInstallations,
  useOrganizations,
} from '@oppenheimer/frontend-consumer/react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { workspaceAddress } from '@/features/organizations/lib/workspace-address';

/**
 * The landing after onboarding: a success ring, the three facts the steps
 * produced, one button into the console.
 *
 * Each row names what its step produced, found by the id that step carried
 * here — not by taking the head of a list. An account that already owned a
 * machine, or connected a second GitHub account, would otherwise be shown
 * whichever row came first and told it was the one they just made.
 *
 * A step that was skipped has nothing to show, and the row says so rather than
 * printing a zero. Both GitHub and the host step are skippable, so both empty
 * states are reachable.
 */
export function OnboardingReadyScreen({
  installationId,
  hostId,
}: {
  /** The installation Connect GitHub wrote, when it ran. */
  installationId?: string;
  /** The host Add host paired, when it ran. */
  hostId?: string;
}) {
  const { t } = useTranslation();

  const { data: organizations, isPending: loadingWorkspace } = useOrganizations();
  const { data: installations, isPending: loadingGithub } = useInstallations();
  const { data: hosts, isPending: loadingHosts } = useHosts();

  // The workspace is genuinely the caller's only one — it is personal, and the
  // claim step wrote to that row.
  const workspace = organizations?.[0];
  const installation = installationId
    ? installations?.find((row) => row.id === installationId)
    : undefined;
  const host = hostId ? hosts?.find((row) => row.id === hostId) : undefined;

  const { data: repositories, isPending: loadingRepositories } = useInstallationRepositories(
    installation && !installation.coversEveryRepository ? installation.id : undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3.5">
        <SuccessMark />
        <StepHeader title={t('onboarding.flow.ready.title')}>
          {t('onboarding.flow.ready.description', { workspace: workspace?.name ?? '' })}
        </StepHeader>
      </div>

      <SummaryCard>
        <SummaryRow label={t('onboarding.flow.ready.workspace')}>
          {loadingWorkspace ? (
            <Skeleton className="h-3 w-40" />
          ) : workspace ? (
            workspaceAddress(workspace.slug)
          ) : (
            t('onboarding.flow.ready.noWorkspace')
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.code')}>
          {installationId && loadingGithub ? (
            <Skeleton className="h-3 w-32" />
          ) : !installation ? (
            t('onboarding.flow.ready.noGithub')
          ) : installation.coversEveryRepository ? (
            installation.accountLogin
          ) : loadingRepositories ? (
            // The account is known before the count is. Showing it alone beats
            // printing "0 repositories" at a reader who has just connected.
            installation.accountLogin
          ) : (
            t('onboarding.flow.ready.repos', {
              owner: installation.accountLogin,
              count: repositories?.length ?? 0,
            })
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.host')}>
          {hostId && loadingHosts ? (
            <Skeleton className="h-3 w-36" />
          ) : host ? (
            host.summary
          ) : (
            t('onboarding.flow.ready.noHost')
          )}
        </SummaryRow>
      </SummaryCard>

      <Button size="lg" block render={<Link to="/sessions" />}>
        {t('onboarding.flow.ready.go')}
      </Button>
    </div>
  );
}
