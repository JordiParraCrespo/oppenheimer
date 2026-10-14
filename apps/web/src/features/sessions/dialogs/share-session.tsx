import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Skeleton,
} from '@oppenheimer/design-system-web';
import {
  useHosts,
  usePutSessionShare,
  useSession,
  useSessionShare,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareSessionForm } from '../forms/share-session';
import { SHARE_DEFAULTS } from '../lib/share-session';
import { ShareAddPeople } from '../sections/share-add-people';
import { ShareSessionAccess } from '../sections/share-session-access';

/**
 * Share a session (`ShareSession.dc.html`, and the Share dialog of
 * `SessionsConsole (pages).dc.html`), from the terminal's status line or a
 * session row's menu. A session not yet shared opens on Share session: who,
 * permission, for how long. A shared one opens on Sharing: the link, who has
 * access and until when. Add people on a share for specific people adds to
 * its list and leaves its permission and expiry alone; on a link it is
 * sharing again, with specific people, from Share session.
 */
export function ShareSessionDialog({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const session = useSession(sessionId);
  const hostId = session.data?.hostId;
  const hostName = useHosts({
    select: (hosts) => hosts.find((host) => host.id === hostId)?.name,
    enabled: Boolean(hostId),
  }).data;
  const host = hostName ?? t('sessions.share.thisHost');
  const share = useSessionShare(sessionId);
  const put = usePutSessionShare();
  const [view, setView] = useState<'access' | 'add' | 'reshare'>('access');

  const current = share.data ?? null;
  const composing = !share.isPending && (current === null || view === 'reshare');
  const adding = current !== null && view === 'add';
  const title = adding
    ? t('sessions.share.addTitle')
    : composing || share.isPending
      ? t('sessions.share.title')
      : t('sessions.share.managing');

  return (
    <Dialog open onOpenChange={(open) => !open && !put.isPending && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-sm">{session.data?.name}</span>
            {' · '}
            {t('sessions.share.on', { host })}
          </DialogDescription>
        </DialogHeader>
        {share.isPending ? (
          <DialogBody>
            <Skeleton className="h-64 w-full" />
          </DialogBody>
        ) : share.error ? (
          <DialogBody>
            <ErrorAlert error={share.error} fallback={t('sessions.share.loadFailed')} />
          </DialogBody>
        ) : composing ? (
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
        ) : current ? (
          <ShareSessionAccess
            sessionId={sessionId}
            share={current}
            onAddPeople={() => {
              put.reset();
              setView(current.audience === 'people' ? 'add' : 'reshare');
            }}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
