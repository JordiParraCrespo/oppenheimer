import { PeoplePicker, type Person } from '@oppenheimer/design-system-web';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '../lib/share-session';

/** Someone named by email: outside the workspace, since workspaces are personal for now. */
function personOf(email: string): Person {
  return { id: email, name: email, email, initials: initialsOf(email), external: true };
}

/**
 * Who a session is shared with, as the design system's `PeoplePicker`
 * (`ShareSession.dc.html`). Workspaces are personal, so there is no member to
 * suggest: a whole address offers "Invite …". What is still typed is handed
 * up as it changes, so Share takes a typed address the way the design does.
 * People already on the share are never added twice.
 */
export function SharePeoplePicker({
  value,
  exclude = [],
  onChange,
  onTyped,
}: {
  value: string[];
  /** People already on the share. */
  exclude?: readonly string[];
  onChange: (people: string[]) => void;
  onTyped: (text: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <PeoplePicker
      people={[]}
      value={value.map(personOf)}
      onValueChange={(next) =>
        onChange(
          next
            .map((person) => person.email.toLowerCase())
            .filter((email) => !exclude.includes(email)),
        )
      }
      onQueryChange={onTyped}
      labels={{
        placeholder: t('sessions.share.peoplePlaceholder'),
        empty: t('sessions.share.inviteEmpty'),
        invite: (email) => t('sessions.share.invite', { email }),
        inviteDescription: t('sessions.share.inviteHint'),
        outside: t('sessions.share.outside'),
        remove: (name) => t('sessions.share.removePerson', { name }),
      }}
    />
  );
}
