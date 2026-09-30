import {
  RoutineItem,
  RoutineRun,
  RoutineRunList,
  RoutineRunsEmpty,
} from '@oppenheimer/design-system-web';
import type { AutomationEntity } from '@oppenheimer/frontend-consumer';
import { formatAge } from '@oppenheimer/frontend-web';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { TriggerGlyph } from '../components/trigger-glyph';
import { runState, sidebarMeta } from '../lib/automation-view';

/**
 * One automation in the sidebar and, while it is the selected one, its last
 * six runs, each opening the session it started in the run view.
 *
 * It is a section because what it subscribes to is the route: the automation
 * is selected on its page and on any of its runs' sessions, and the router
 * hands the row only that — which run's session is open, if this is the
 * automation that is — so a navigation re-renders the rows whose selection
 * moved and not the list above them. `now` is its group's minute clock.
 */
export function AutomationSidebarRow({
  automation,
  now,
}: {
  automation: AutomationEntity;
  now: number;
}) {
  const { t } = useTranslation();
  const base = `/automations/${automation.id}`;
  // `false` when another automation is selected; otherwise the open run's
  // session id, or `null` on the automation's own page.
  const selection = useRouterState({
    select: (state): string | null | false => {
      const { pathname } = state.location;
      if (pathname === base) return null;
      const session = pathname.startsWith(`${base}/sessions/`)
        ? pathname.slice(`${base}/sessions/`.length)
        : '';
      return session && !session.includes('/') ? session : false;
    },
  });
  const selected = selection !== false;

  return (
    <>
      <RoutineItem
        name={automation.name}
        icon={<TriggerGlyph scheduled={automation.isScheduled} />}
        meta={sidebarMeta(automation, now, t)}
        running={automation.isRunning}
        paused={automation.isPaused}
        active={selected}
        render={<Link to="/automations/$automationId" params={{ automationId: automation.id }} />}
      />
      {selected ? (
        <RoutineRunList>
          {automation.lastRuns.length ? (
            automation.lastRuns.map((run) => (
              <RoutineRun
                key={run.id}
                title={run.title}
                // A run that started a session is placed in time; one that
                // never started says why instead. The reason is the more
                // useful of the two facts here and the only one the reader
                // cannot get by opening the row, because there is nothing to
                // open — the runs table, which has a column for each, shows
                // both. The title truncates in a sidebar this narrow, so the
                // words go in this slot rather than onto the end of it.
                ago={
                  run.sessionId
                    ? formatAge(run.createdAt, now, t)
                    : t(`automations.runStatus.${run.status}`)
                }
                state={runState(run.status)}
                disabled={!run.sessionId}
                active={Boolean(run.sessionId) && run.sessionId === selection}
                render={
                  run.sessionId ? (
                    <Link
                      to="/automations/$automationId/sessions/$sessionId"
                      params={{ automationId: automation.id, sessionId: run.sessionId }}
                    />
                  ) : undefined
                }
              />
            ))
          ) : (
            <RoutineRunsEmpty>{t('automations.sidebar.noRuns')}</RoutineRunsEmpty>
          )}
        </RoutineRunList>
      ) : null}
    </>
  );
}
