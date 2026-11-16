import { QueryState } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { SessionSkeleton } from '../components/session-skeleton';
import { SessionPane } from './session-pane';
import { SessionTerminal } from './session-terminal';

/**
 * Another session, on any host, in the side pane beside this one: the same
 * pane its own page draws, without its bar, so the view switch, the latency
 * and Share sit on its terminal's status line as they do under a pull
 * request. It has no side pane of its own: that is offered only with a bar.
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
          terminal={(session, reading, statusItems) => (
            <SessionTerminal
              sessionId={session.id}
              hostId={session.hostId ?? ''}
              statusItems={statusItems}
              reading={reading}
            />
          )}
        />
      </QueryState.Data>
    </QueryState>
  );
}
