import { Button } from '@oppenheimer/design-system-web';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SharePeoplePicker } from '../components/share-people-picker';
import { ShareWriteWarning } from '../components/share-write-warning';
import { namedPeople } from '../lib/share-session';

/**
 * Share's first line: people to invite, by email, and Invite. It owns what
 * is being typed, so a keystroke redraws this line and not the list below;
 * the write is the panel's, so no other change to the share can run beside
 * it (`busy`).
 *
 * Inviting people to a share that can write gives them a shell on the host
 * as the sharer, so while anyone is typed in for one (`writeHost`) the line
 * says so and asks to be understood before Invite. `ready` is false while a
 * share not yet made waits on the panel's own warning.
 */
export function ShareInvite({
  listed,
  busy,
  inviting,
  ready,
  writeHost,
  linkShared,
  onInvite,
}: {
  /** People already on the share. */
  listed: readonly string[];
  busy: boolean;
  /** An invite of this line's is in flight. */
  inviting: boolean;
  ready: boolean;
  /** The host's name when the people invited will be able to write, else null. */
  writeHost: string | null;
  /** Inviting to a link limits the link to the people invited. */
  linkShared: boolean;
  /** Share with these people; `done` clears the line once it landed. */
  onInvite: (people: string[], done: () => void) => void;
}) {
  const { t } = useTranslation();
  const [people, setPeople] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [ack, setAck] = useState(false);
  const adding = namedPeople({ people, typed }).filter((email) => !listed.includes(email));
  const warn = writeHost !== null && adding.length > 0;
  const who =
    adding.length === 1
      ? adding[0]
      : t('sessions.share.writeWarningCount', { count: adding.length });

  return (
    <div className="flex flex-col gap-2">
      <form
        noValidate
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onInvite(adding, () => {
            setPeople([]);
            setTyped('');
            setAck(false);
          });
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
          disabled={busy || adding.length === 0 || !ready || (warn && !ack)}
          pending={inviting}
          pendingLabel={t('sessions.share.inviting')}
        >
          {t('sessions.share.inviteSubmit')}
        </Button>
      </form>
      {warn ? <ShareWriteWarning who={who} host={writeHost} ack={ack} onAck={setAck} /> : null}
      {linkShared ? (
        <p className="text-[12px] text-fg-subtle">{t('sessions.share.inviteNarrows')}</p>
      ) : null}
    </div>
  );
}
