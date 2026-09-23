import { Stepper } from '@oppenheimer/design-system-web';
import { deriveSessionStartSteps, type SessionEntity } from '@oppenheimer/frontend-consumer';
import { useHosts, useSessionEvents } from '@oppenheimer/frontend-consumer/react';
import { CODING_AGENTS, type CodingAgentId } from '@oppenheimer/shared/agents';
import { useTranslation } from 'react-i18next';
import { useElapsed } from '../hooks/use-elapsed';
import { provisioningSteps, startFailure } from '../lib/provisioning-steps';

/**
 * A session that is not a terminal yet.
 *
 * The export's provisioning pane (`SessionsConsole.dc.html`, `op-provision`):
 * the host as the eyebrow, "Starting your session", the scope line, and named
 * steps with a ring, a check and a mono meta line, so a slow step is
 * diagnosable instead of just slow. The steps are the host's own account of
 * the start — `session.step` events read back off the session's log, polled
 * until the log says how the start ended — so nothing on this pane moves on
 * its own: a progress bar that advances by itself is a lie about a machine
 * somebody else's work is running on.
 */
export function SessionProvisioning({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const failed = session.lifecycle === 'failed';
  const elapsed = useElapsed(session.createdAt, !failed);
  const { data: events = [] } = useSessionEvents(session.id);
  const { data: hosts } = useHosts();

  const host = hosts?.find((row) => row.id === session.hostId);
  const checkout = session.cwdCheckout;
  const repo = checkout?.repositoryFullName.split('/').pop() ?? session.slug;
  const branch = checkout?.branch ?? session.slug;
  const agent = CODING_AGENTS[session.agent as CodingAgentId]?.label ?? session.agent;

  const steps = provisioningSteps(
    deriveSessionStartSteps(failed ? [...events, failedMarker(events)] : events),
    {
      host: host?.name ?? t('sessions.provisioning.steps.host.fallback'),
      hostOnline: host ? host.online : null,
      repo,
      branch,
      agent,
      failure: startFailure(events),
    },
    t,
  );

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      {/* The export's provisioning pane: a 420px column centred in whatever
          room the shell gives it (`.op-provision__inner`). */}
      <div className="m-auto w-full max-w-[420px] p-8">
        <p className="figures text-[11px] tracking-[0.06em] text-fg-muted uppercase">
          {host?.name ?? session.scopeLabel ?? session.slug}
        </p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.018em] text-fg">
          {t(failed ? 'sessions.provisioning.failedTitle' : 'sessions.provisioning.title')}
        </h1>
        <p className="mt-1.5 text-operate text-fg-muted">
          {failed ? t('sessions.provisioning.failedLead') : session.scopeLabel}
        </p>

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

/**
 * The row can say `failed` before the log page this pane holds does — the two
 * are separate reads — so a failed row stands for its own `session.failed`.
 */
function failedMarker(events: readonly { seq: number }[]) {
  const last = events.reduce((max, event) => Math.max(max, event.seq), 0);
  return { seq: last + 1, kind: 'session.failed', payload: {}, occurredAt: new Date() };
}
