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
  useSetSessionSharePeople,
} from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShareSessionForm } from '../forms/share-session';
import { shareDefaults } from '../lib/share-session';
import { ShareSessionAccess } from '../sections/share-session-access';

/**
 * Share a session (`ShareSession.dc.html`, and the Share dialog of
 * `SessionsConsole (pages).dc.html`), from the terminal's status line or a
 * session row's menu. A session not yet shared opens on Share session: who,
 * permission, for how long. A shared one opens on Sharing: the link, who has
 * access and until when; Add people goes back to the form with the share as
 * it is: with only people added it sends only the people, so the expiry
 * stands, and anything else replaces the share at the same address.
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
  const narrow = useSetSessionSharePeople();
  const [adding, setAdding] = useState(false);
  const pending = put.isPending || narrow.isPending;

  const current = share.data ?? null;
  const composing = !share.isPending && (current === null || adding);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent size="form" closeLabel={t('common.close')}>
        <DialogHeader>
          <DialogTitle>
            {composing || share.isPending
              ? t('sessions.share.title')
              : t('sessions.share.managing')}
          </DialogTitle>
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
            defaults={shareDefaults(adding ? current : null)}
            share={adding ? current : null}
            host={host}
            pending={pending}
            error={put.error ?? narrow.error}
            onSubmit={(submission) => {
              const done = { onSuccess: () => setAdding(false) };
              if (submission.kind === 'put')
                put.mutate({ sessionId, input: submission.input }, done);
              else if (submission.people.length) {
                narrow.mutate({ sessionId, people: submission.people }, done);
              } else setAdding(false);
            }}
            onCancel={() => (current ? setAdding(false) : onClose())}
          />
        ) : current ? (
          <ShareSessionAccess
            sessionId={sessionId}
            share={current}
            onAddPeople={() => {
              put.reset();
              narrow.reset();
              setAdding(true);
            }}
            onDone={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
