import { DialogDescription, DialogHeader, DialogTitle } from '@oppenheimer/design-system-web';
import {
  type usePutSessionShare,
  useSuspenseSessionShare,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareSessionForm } from '../forms/share-session';
import { SHARE_DEFAULTS } from '../lib/share-session';
import { ShareAddPeople } from './share-add-people';
import { ShareSessionAccess } from './share-session-access';

/**
 * The share dialog's header and pane, in `ShareSessionDialog`'s
 * `QueryState.Data`: the session, its share and the hosts read under
 * Suspense. A session not yet shared opens on Share session; a shared one on
 * Sharing; Add people on a share for specific people adds to its list, and on
 * a link it is sharing again, with specific people, from Share session. The
 * write is the dialog's, which holds Close while it is in flight. A refetch
 * that fails keeps the pane and says so above it.
 */
export function ShareSessionPanes({
  sessionId,
  put,
  onClose,
}: {
  sessionId: string;
  put: ReturnType<typeof usePutSessionShare>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { session, share: current, hosts, error } = useSuspenseSessionShare(sessionId);
  const host = hosts.find((row) => row.id === session.hostId)?.name ?? t('sessions.share.thisHost');
  const [view, setView] = useState<'access' | 'add' | 'reshare'>('access');
  const composing = current === null || view === 'reshare';
  const adding = current !== null && view === 'add';
  const title = adding
    ? t('sessions.share.addTitle')
    : composing
      ? t('sessions.share.title')
      : t('sessions.share.managing');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          <span className="font-mono text-sm">{session.name}</span>
          {' · '}
          {t('sessions.share.on', { host })}
        </DialogDescription>
      </DialogHeader>
      <ErrorAlert error={error} fallback={t('sessions.share.loadFailed')} className="mx-6" />
      {composing ? (
        <ShareSessionForm
          defaults={SHARE_DEFAULTS}
          host={host}
          pending={put.isPending}
          error={put.error}
          onSubmit={(input) =>
            put.mutate({ sessionId, input }, { onSuccess: () => setView('access') })
          }
          onCancel={() => (current ? setView('access') : onClose())}
        />
      ) : adding ? (
        <ShareAddPeople sessionId={sessionId} share={current} onBack={() => setView('access')} />
      ) : (
        <ShareSessionAccess
          sessionId={sessionId}
          share={current}
          onAddPeople={() => {
            put.reset();
            setView(current.audience === 'people' ? 'add' : 'reshare');
          }}
          onDone={onClose}
        />
      )}
    </>
  );
}
