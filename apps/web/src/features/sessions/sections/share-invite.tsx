import { Button } from '@oppenheimer/design-system-web';
import type { SessionShare } from '@oppenheimer/frontend-consumer';
import { usePutSessionShare, useSetSessionSharePeople } from '@oppenheimer/frontend-consumer/react';
import { ErrorAlert } from '@oppenheimer/frontend-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharePeoplePicker } from '../components/share-people-picker';
import { namedPeople, type ShareSettings, settingsOf, shareInput } from '../lib/share-session';

/**
 * Share's first line: people to invite, by email, and Invite. It owns what
 * is being typed, so a keystroke redraws this line and not the list below.
 *
 * On a session not yet shared, Invite shares it with them as `draft` says;
 * on a share for specific people it adds them, keeping what they may do and
 * until when; on a link it limits the link to them (the address stays).
 * `ready` is false while write access waits to be understood.
 */
export function ShareInvite({
  sessionId,
  share,
  draft,
  ready,
  onShared,
}: {
  sessionId: string;
  share: SessionShare | null;
  /** How a session not yet shared is about to be. */
  draft: ShareSettings;
  ready: boolean;
  /** Told once the people are on the share. */
  onShared: () => void;
}) {
  const { t } = useTranslation();
  const put = usePutSessionShare();
  const add = useSetSessionSharePeople();
  const [people, setPeople] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const listed = share?.people ?? [];
  const adding = namedPeople({ people, typed }).filter((email) => !listed.includes(email));
  const pending = put.isPending || add.isPending;

  function invite() {
    const done = {
      onSuccess: () => {
        setPeople([]);
        setTyped('');
        onShared();
      },
    };
    if (!share) put.mutate({ sessionId, input: shareInput(draft, adding) }, done);
    else if (share.audience === 'people')
      add.mutate({ sessionId, people: [...share.people, ...adding] }, done);
    else
      put.mutate(
        {
          sessionId,
          input: shareInput({ ...settingsOf(share, Date.now()), audience: 'people' }, adding),
        },
        done,
      );
  }

  return (
    <div className="flex flex-col gap-2">
      <ErrorAlert
        error={put.error ?? add.error}
        fallback={share ? t('sessions.share.updateFailed') : t('sessions.share.failed')}
      />
      <form
        noValidate
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          invite();
        }}
      >
        <div className="min-w-0 flex-1">
          <SharePeoplePicker
            value={people}
            exclude={listed}
            onChange={setPeople}
            onTyped={setTyped}
          />
        </div>
        <Button
          type="submit"
          disabled={adding.length === 0 || !ready}
          pending={pending}
          pendingLabel={t('sessions.share.inviting')}
        >
          {t('sessions.share.inviteSubmit')}
        </Button>
      </form>
      {share?.audience === 'link' ? (
        <p className="text-[12px] text-fg-subtle">{t('sessions.share.inviteNarrows')}</p>
      ) : null}
    </div>
  );
}
