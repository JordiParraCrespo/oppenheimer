import { Alert, AlertDescription, Stepper } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessionStartProgress } from '@oppenheimer/frontend-consumer/react';
import { useErrorMessage } from '@oppenheimer/frontend-core/react';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { useElapsed } from '../hooks/use-elapsed';
import { failureReason, PENDING_START, provisioningSteps } from '../lib/provisioning-steps';

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
  const resolveError = useErrorMessage();
  const failed = session.lifecycle === 'failed';
  const elapsed = useElapsed(session.createdAt, !failed);
  const progress = useSessionStartProgress(session.id, {
    starting: session.isProvisioning,
    failed,
  });
  // The list is the one place a host's name lives; its presence is the row's.
  // Only that one name is subscribed to, so a refetch of the host list
  // re-renders this pane when the name changes and not otherwise.
  const { data: hostName } = useHosts({
    select: (hosts) => hosts.find((row) => row.id === session.hostId)?.name,
  });
  const host = hostName ?? t('sessions.provisioning.steps.host.fallback');
  const checkout = session.cwdCheckout;

  const steps = provisioningSteps(
    progress.data?.steps ?? PENDING_START,
    {
      host,
      hostOffline: session.isHostOffline,
      repo: checkout?.repositoryName ?? session.slug,
      branch: checkout?.branch ?? session.slug,
      agent: CODING_AGENTS[session.agent].label,
      failure: failureReason(progress.data?.failure, t),
    },
    t,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      {/* The export's provisioning pane: a 420px column centred in whatever
          room the shell gives it (`.op-provision__inner`). */}
      <div className="m-auto w-full max-w-[420px] p-8">
        <p className="figures text-[11px] tracking-[0.06em] text-fg-muted uppercase">{host}</p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.018em] text-fg">
          {t(failed ? 'sessions.provisioning.failedTitle' : 'sessions.provisioning.title')}
        </h1>
        <p className="mt-1.5 text-operate text-fg-muted">
          {failed ? t('sessions.provisioning.failedLead') : session.scopeLabel}
        </p>

        {progress.error ? (
          <Alert variant="destructive" className="mt-6.5">
            <AlertDescription>
              {resolveError(progress.error, t('sessions.provisioning.progressFailed')).message}
            </AlertDescription>
          </Alert>
        ) : null}

        <Stepper
          className="mt-6.5"
          steps={steps}
          elapsed={elapsed}
          status={t(failed ? 'sessions.provisioning.failed' : 'sessions.provisioning.working')}
        />
      </div>
    </div>
  );
}
