import { Callout, Stepper } from '@oppenheimer/design-system-web';
import { type SessionEntity, sessionAgentLabel } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessionStartProgress } from '@oppenheimer/frontend-consumer/react';
import {
  ErrorAlert,
  PageFrame,
  StartFailureDetail,
  useStartFailure,
} from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { CodexEnvironmentHelp } from '../components/codex-environment-help';
import { ElapsedClock } from '../components/elapsed-clock';
import { PENDING_START, provisioningSteps } from '../lib/provisioning-steps';

/** The runner's code for a Codex cloud start that found no environment the CLI can reach. */
const CODEX_NO_ENVIRONMENT = 'SESS_010';

/**
 * A session that is not a terminal yet.
 *
 * The export's provisioning pane (`SessionsConsole.dc.html`, `op-provision`):
 * the host as the eyebrow, "Starting your session", the scope line, and named
 * steps with a ring, a check and a mono meta line, so a slow step is
 * diagnosable instead of just slow. The steps are the host's own account of
 * the start, read off the session's log; a step the host has not reported is
 * pending, so nothing on this pane advances on its own.
 */
export function SessionProvisioning({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const failed = session.lifecycle === 'failed';
  // Mounted while the start is in hand, which outlasts the row's `starting`:
  // the row opens with the pane, and this pane stays until the agent runs.
  const progress = useSessionStartProgress(session.id, { starting: !failed, failed });
  // The list is the one place a host's name lives; its presence is the row's.
  // Only that one name is subscribed to, so a refetch of the host list
  // re-renders this pane when the name changes and not otherwise.
  const { data: hostName } = useHosts({
    select: (hosts) => hosts.find((row) => row.id === session.hostId)?.name,
  });
  const host = hostName ?? t('sessions.provisioning.steps.host.fallback');
  const checkout = session.cwdCheckout;

  const failure = useStartFailure(progress.data?.failure, t('sessions.provisioning.failed'));
  const steps = provisioningSteps(
    progress.data?.steps ?? PENDING_START,
    {
      host,
      hostOffline: session.isHostOffline,
      repo: checkout?.repositoryName ?? session.slug,
      branch: checkout?.branch ?? session.slug,
      agent: sessionAgentLabel(session.agent),
      failure: failure?.reason ?? null,
      folder: session.isFolder ? session.folderPath : null,
      shell: session.agent === 'shell',
    },
    t,
  );

  return (
    // The session's route is `full`, for the terminal it becomes; while it is
    // being prepared it is a page, the shell's frame at the `status` measure
    // (`.op-provision__inner`, centred in the pane).
    <PageFrame size="status">
      <div>
        <p className="figures text-micro text-fg-muted uppercase">{host}</p>
        <h1 className="mt-2 font-display text-h2 font-semibold text-fg">
          {t(failed ? 'sessions.provisioning.failedTitle' : 'sessions.provisioning.title')}
        </h1>
        <p className="mt-1.5 text-operate text-fg-muted">
          {failed ? t('sessions.provisioning.failedLead') : session.scopeLabel}
        </p>

        {/* The one start that is slow on purpose: said up front, so the wait
            reads as a first time rather than as something stuck. */}
        {progress.data?.downloading ? (
          <Callout className="mt-6.5">{t('sessions.provisioning.downloading')}</Callout>
        ) : null}

        <ErrorAlert
          error={progress.error}
          fallback={t('sessions.provisioning.progressFailed')}
          className="mt-6.5"
        />

        <Stepper
          className="mt-6.5"
          steps={steps}
          // An element, not a string: the one-second tick re-renders the clock,
          // not this pane.
          elapsed={<ElapsedClock since={session.createdAt} ticking={!failed} />}
          status={t(failed ? 'sessions.provisioning.failed' : 'sessions.provisioning.working')}
        />

        {/* The host's own words, English and for whoever reads its logs: a
            secondary line under the translated reason, never the reason. */}
        {failed && progress.data?.failure?.code === CODEX_NO_ENVIRONMENT ? (
          <CodexEnvironmentHelp className="mt-6.5" />
        ) : null}
        {failed && failure?.detail ? (
          <StartFailureDetail detail={failure.detail} className="mt-4" />
        ) : null}
      </div>
    </PageFrame>
  );
}
