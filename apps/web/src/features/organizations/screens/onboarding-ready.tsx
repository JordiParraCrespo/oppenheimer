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
import { LoadingStatus } from '@oppenheimer/frontend-web';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { workspaceAddress } from '@/features/organizations/lib/workspace-address';

/** Where the workspace's name goes in the lead while it loads. */
const NAME_SLOT = '\u0000';

/**
 * The landing after onboarding. Each row finds what its step produced by the
 * id that step carried here, not the head of a list, or an account with an
 * older machine or a second GitHub account would be shown the wrong row. A
 * skipped step (GitHub and host both can be) has nothing to show, and its row
 * says so rather than printing a zero.
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

  const {
    data: organizations,
    isPending: loadingWorkspace,
    isError: workspaceFailed,
  } = useOrganizations();
  const {
    data: installations,
    isPending: loadingGithub,
    isError: githubFailed,
  } = useInstallations();
  const { data: hosts, isPending: loadingHosts, isError: hostsFailed } = useHosts();

  // The workspace is genuinely the caller's only one — it is personal, and the
  // claim step wrote to that row.
  const workspace = organizations?.[0];
  const installation = installationId
    ? installations?.find((row) => row.id === installationId)
    : undefined;
  const host = hostId ? hosts?.find((row) => row.id === hostId) : undefined;

  const {
    data: repositories,
    isPending: loadingRepositories,
    isError: repositoriesFailed,
  } = useInstallationRepositories(
    installation && !installation.coversEveryRepository ? installation.id : undefined,
  );

  const loading =
    loadingWorkspace ||
    (installationId !== undefined && loadingGithub) ||
    (hostId !== undefined && loadingHosts);
  const [beforeName, afterName] = t('onboarding.flow.ready.description', {
    workspace: NAME_SLOT,
  }).split(NAME_SLOT);

  return (
    <div aria-busy={loading || undefined} className="flex flex-col gap-6">
      {loading && <LoadingStatus />}
      <div className="flex flex-col gap-3.5">
        <SuccessMark label={t('onboarding.flow.ready.doneLabel')} />
        {/* The lead names the workspace, so it waits for it: a bar in the
            name's place while it loads, and no lead when there is none to
            name (the Workspace row says why). */}
        {workspace ? (
          <StepHeader title={t('onboarding.flow.ready.title')}>
            {t('onboarding.flow.ready.description', { workspace: workspace.name })}
          </StepHeader>
        ) : (
          <div>
            <StepHeader title={t('onboarding.flow.ready.title')} />
            {loadingWorkspace && (
              <div className="mt-2.5 text-body leading-normal text-pretty text-fg-muted">
                {beforeName}
                <span className="inline-flex h-5.5 items-center align-bottom">
                  <Skeleton shape="sm" className="h-3.5 w-28" />
                </span>
                {afterName}
              </div>
            )}
          </div>
        )}
      </div>

      <SummaryCard>
        <SummaryRow label={t('onboarding.flow.ready.workspace')}>
          {/* A failed read says so: "no workspace" would be a claim about the
              account, and it is only a claim about the request. */}
          {workspaceFailed ? (
            t('onboarding.flow.ready.failed')
          ) : loadingWorkspace ? (
            <span className="inline-flex h-5 items-center align-bottom">
              <Skeleton shape="sm" className="h-3 w-40" />
            </span>
          ) : workspace ? (
            workspaceAddress(workspace.slug)
          ) : (
            t('onboarding.flow.ready.noWorkspace')
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.code')}>
          {installationId && githubFailed ? (
            t('onboarding.flow.ready.failed')
          ) : installationId && loadingGithub ? (
            <span className="inline-flex h-5 items-center align-bottom">
              <Skeleton shape="sm" className="h-3 w-32" />
            </span>
          ) : !installation ? (
            t('onboarding.flow.ready.noGithub')
          ) : installation.coversEveryRepository ? (
            installation.accountLogin
          ) : repositoriesFailed ? (
            // A failed count is a failed read, not a connected account minus a
            // number: say so, like the other rows.
            t('onboarding.flow.ready.failed')
          ) : loadingRepositories ? (
            // The account is known before the count is. Showing it alone beats
            // "0 repositories", which under a connection that just succeeded
            // reads as a failure.
            installation.accountLogin
          ) : (
            t('onboarding.flow.ready.repos', {
              owner: installation.accountLogin,
              count: repositories?.length ?? 0,
            })
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.host')}>
          {hostId && hostsFailed ? (
            t('onboarding.flow.ready.failed')
          ) : hostId && loadingHosts ? (
            <span className="inline-flex h-5 items-center align-bottom">
              <Skeleton shape="sm" className="h-3 w-36" />
            </span>
          ) : host ? (
            host.summary
          ) : (
            t('onboarding.flow.ready.noHost')
          )}
        </SummaryRow>
      </SummaryCard>

      {/* `replace`: the walk ends here, so the landing should not be the entry
          Back returns to. The route's own guard is what makes that a rule
          rather than a habit — a typed or bookmarked `/onboarding/ready`
          without the walk never mounts this page at all. */}
      <Button size="lg" block render={<Link to="/" replace />}>
        {t('onboarding.flow.ready.go')}
      </Button>
    </div>
  );
}
