import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SessionSkeleton } from '../components/session-skeleton';
import { SessionPane } from './session-pane';
import { SessionTerminal } from './session-terminal';
import { SideSessionStatus } from './side-session-status';

/**
 * Another session, on any host, in the side pane beside this one: the same
 * pane its own page draws, without its bar. Its status line keeps the link's
 * state and the view switch (`SideSessionStatus`); the latency and Share are
 * its own page's. It has no side pane of its own: that is offered only with
 * a bar.
 */
export function SideSession({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation();

  return (
    <QueryState>
      <QueryState.Pending>
        <SessionSkeleton />
      </QueryState.Pending>
      <QueryState.Error fallback={t('sessions.side.sessionLoadFailed')} />
      <QueryState.Data>
        <SessionPane
          sessionId={sessionId}
          terminal={(session, reading) => (
            <SessionTerminal
              sessionId={session.id}
              agent={session.agent}
              hostId={session.hostId ?? ''}
              statusItems={<SideSessionStatus reading={reading} />}
              reading={reading}
            />
          )}
        />
      </QueryState.Data>
    </QueryState>
  );
}
