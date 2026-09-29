import { Stepper } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessionStartProgress } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { CODING_AGENTS } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { ElapsedClock } from '../components/elapsed-clock';
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
  const { t, i18n } = useTranslation();
  const failed = session.lifecycle === 'failed';
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

  const failure = failureReason(progress.data?.failure, t, (code) => {
    const key = `errors.byCode.${code}`;
    return i18n.exists(key) ? (i18n.t(key as never) as string) : undefined;
  });
  const steps = provisioningSteps(
    progress.data?.steps ?? PENDING_START,
    {
      host,
      hostOffline: session.isHostOffline,
      repo: checkout?.repositoryName ?? session.slug,
      branch: checkout?.branch ?? session.slug,
      agent: CODING_AGENTS[session.agent].label,
      failure: failure?.reason ?? null,
    },
    t,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas-recessed">
      {/* The export's provisioning pane: a 420px column centred in whatever
          room the shell gives it (`.op-provision__inner`). */}
      <div className="m-auto w-full max-w-105 p-8">
        <p className="figures text-micro text-fg-muted uppercase">{host}</p>
        <h1 className="mt-2 font-display text-h2 font-semibold text-fg">
          {t(failed ? 'sessions.provisioning.failedTitle' : 'sessions.provisioning.title')}
        </h1>
        <p className="mt-1.5 text-operate text-fg-muted">
          {failed ? t('sessions.provisioning.failedLead') : session.scopeLabel}
        </p>

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
        {failed && failure?.detail ? (
          <p className="mt-4 text-xs break-words text-fg-subtle">
            {t('sessions.provisioning.details', { detail: failure.detail })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
