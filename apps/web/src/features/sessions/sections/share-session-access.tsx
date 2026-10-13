import {
  AccessList,
  AccessRow,
  Avatar,
  Button,
  DialogBody,
  DialogFooter,
  Field,
  FieldDescription,
  FieldLabel,
  useNow,
} from '@oppenheimer/design-system-web';
import type { SessionShare } from '@oppenheimer/frontend-consumer';
import {
  useSetSessionSharePeople,
  useStopSessionShare,
} from '@oppenheimer/frontend-consumer/react';
import { useProfile } from '@oppenheimer/frontend-core/react';
import { ErrorAlert, useLocale } from '@oppenheimer/frontend-web';
import { useTranslation } from 'react-i18next';
import { ShareLinkCopy } from '../components/share-link-copy';
import { initialsOf, shareTimeLeft, shareUrl } from '../lib/share-session';

/** The time left on each row moves with the clock, to the minute. */
const CLOCK_MS = 60_000;

/**
 * Sharing (`ShareSession.dc.html`): the link to copy, who has access and for
 * how long, and the way to take it back. × on a person takes them off the
 * list, and on the last one, or on the link, stops sharing: the dialog then
 * opens on Share session again. Stop sharing ends it and closes the dialog.
 */
export function ShareSessionAccess({
  sessionId,
  share,
  onAddPeople,
  onDone,
}: {
  sessionId: string;
  share: SessionShare;
  onAddPeople: () => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const locale = useLocale();
  const now = useNow(CLOCK_MS);
  const me = useProfile().data?.id;
  const stop = useStopSessionShare();
  const narrow = useSetSessionSharePeople();
  const busy = stop.isPending || narrow.isPending;

  const role = t(`sessions.share.roles.${share.access}`);
  const ends =
    share.expiresAt === null
      ? t('sessions.share.never')
      : share.expiresAt.getTime() <= now
        ? t('sessions.share.expired')
        : shareTimeLeft(share.expiresAt.getTime() - now, locale, t);

  function remove(email: string) {
    const people = share.people.filter((person) => person !== email);
    if (people.length) narrow.mutate({ sessionId, people });
    else stop.mutate({ sessionId });
  }

  return (
    <>
      <DialogBody>
        <div className="flex flex-col gap-5.5">
          <ErrorAlert
            error={stop.error ?? narrow.error}
            fallback={t('sessions.share.updateFailed')}
          />
          <Field>
            <FieldLabel>{t('sessions.share.link')}</FieldLabel>
            <ShareLinkCopy url={shareUrl(window.location.origin, share.slug)} />
            <FieldDescription>
              {share.audience === 'link'
                ? t('sessions.share.linkHintLink')
                : t('sessions.share.linkHintPeople')}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel>{t('sessions.share.whoHasAccess')}</FieldLabel>
            <AccessList>
              {share.sharedBy ? (
                <AccessRow
                  avatar={
                    <Avatar size="sm" variant="accent">
                      {initialsOf(share.sharedBy.name)}
                    </Avatar>
                  }
                  name={share.sharedBy.name}
                  sub={
                    share.sharedBy.id === me
                      ? t('sessions.share.you', { email: share.sharedBy.email })
                      : share.sharedBy.email
                  }
                  role={t('sessions.share.roles.owner')}
                />
              ) : null}
              {share.audience === 'link' ? (
                <AccessRow
                  avatar={<Avatar size="sm">··</Avatar>}
                  name={t('sessions.share.anyoneRow')}
                  sub={t('sessions.share.anyoneRowHint')}
                  role={role}
                  ends={ends}
                  removeLabel={t('sessions.share.removeAccess')}
                  onRemove={busy ? undefined : () => stop.mutate({ sessionId })}
                />
              ) : (
                share.people.map((email) => (
                  <AccessRow
                    key={email}
                    avatar={<Avatar size="sm">{initialsOf(email)}</Avatar>}
                    name={email}
                    sub={t('sessions.share.outside')}
                    role={role}
                    ends={ends}
                    removeLabel={t('sessions.share.removeAccess')}
                    onRemove={busy ? undefined : () => remove(email)}
                  />
                ))
              )}
            </AccessList>
          </Field>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button
          type="button"
          variant="destructive-ghost"
          pending={stop.isPending}
          pendingLabel={t('sessions.share.stopping')}
          disabled={narrow.isPending}
          onClick={() => stop.mutate({ sessionId }, { onSuccess: onDone })}
        >
          {t('sessions.share.stop')}
        </Button>
        <span className="hidden flex-1 sm:block" />
        <Button type="button" variant="secondary" onClick={onAddPeople} disabled={busy}>
          {t('sessions.share.addPeople')}
        </Button>
        <Button type="button" onClick={onDone}>
          {t('sessions.share.done')}
        </Button>
      </DialogFooter>
    </>
  );
}
