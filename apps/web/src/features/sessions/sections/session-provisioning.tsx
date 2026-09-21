import { Stepper } from '@oppenheimer/design-system-web';
import type { SessionEntity } from '@oppenheimer/frontend-consumer';
import { useTranslation } from 'react-i18next';
import { useElapsed } from '../hooks/use-elapsed';

/**
 * A session that is not a terminal yet.
 *
 * `product/versions/mvp/05-screens.md` asks for named steps with a ring, a
 * check and a mono meta line, so a slow step is diagnosable instead of just
 * slow — and the design system ships that as `Stepper`. What it does *not*
 * ship is knowledge of which step a host is on: the control plane derives a
 * session's state from its event log (`GET /sessions/{id}/events`), and this
 * console does not read that log yet. So there is one step here, the one the
 * state actually names, and the day the events are streamed each becomes a
 * row — that is the whole change.
 *
 * Nothing on this pane is invented. A step the API cannot report is not drawn
 * as pending: a progress bar that moves on its own is a lie about a machine
 * somebody else's work is running on.
 */
export function SessionProvisioning({ session }: { session: SessionEntity }) {
  const { t } = useTranslation();
  const failed = session.state === 'failed';
  const elapsed = useElapsed(session.createdAt, !failed);

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-canvas">
      {/* The export's provisioning pane: a 420px column centred in whatever
          room the shell gives it (`.op-provision__inner`). */}
      <div className="m-auto w-full max-w-[420px] p-8">
        <p className="figures text-[11px] tracking-[0.06em] text-fg-muted uppercase">
          {session.repository}
        </p>
        <h1 className="mt-2 font-display text-[26px] leading-[1.15] font-semibold tracking-[-0.018em] text-fg">
          {session.name}
        </h1>
        <p className="mt-1.5 text-operate text-fg-muted">
          {t(failed ? 'sessions.provisioning.failedLead' : 'sessions.provisioning.lead')}
        </p>

        <Stepper
          className="mt-6.5"
          steps={[
            {
              id: 'start',
              label: t('sessions.provisioning.step'),
              meta: session.branch,
              state: failed ? 'failed' : 'running',
            },
          ]}
          elapsed={elapsed}
          status={t(`sessions.state.${session.state}`)}
        />
      </div>
    </div>
  );
}
