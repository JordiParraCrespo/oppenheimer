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

/** The address prefix the artboard shows; the deployment's own comes with wiring. */
const ADDRESS_PREFIX = 'oppenheimer.dev/';

/**
 * The landing after onboarding: a success ring, the three facts the steps
 * produced, one button into the console.
 *
 * Each row reads the thing its step created. A step that was skipped has
 * nothing to show, and the row says so rather than printing a zero — "0
 * repositories" reads like a failure, where "not connected" is the truth.
 */
export function OnboardingReadyScreen() {
  const { t } = useTranslation();

  const { data: organizations, isPending: loadingWorkspace } = useOrganizations();
  const { data: installations, isPending: loadingGithub } = useInstallations();
  const { data: hosts, isPending: loadingHosts } = useHosts();

  const workspace = organizations?.[0];
  const installation = installations?.[0];
  const host = hosts?.[0];

  const { data: repositories } = useInstallationRepositories(
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
            `${ADDRESS_PREFIX}${workspace.slug}`
          ) : (
            t('onboarding.flow.ready.noWorkspace')
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.code')}>
          {loadingGithub ? (
            <Skeleton className="h-3 w-32" />
          ) : installation ? (
            installation.coversEveryRepository ? (
              installation.accountLogin
            ) : (
              t('onboarding.flow.ready.repos', {
                owner: installation.accountLogin,
                count: repositories?.length ?? 0,
              })
            )
          ) : (
            t('onboarding.flow.ready.noGithub')
          )}
        </SummaryRow>
        <SummaryRow label={t('onboarding.flow.ready.host')}>
          {loadingHosts ? (
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
