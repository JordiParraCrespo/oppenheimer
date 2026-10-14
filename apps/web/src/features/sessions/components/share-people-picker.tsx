import { PeoplePicker, type Person } from '@oppenheimer/design-system-web';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { initialsOf, namedPeople } from '../lib/share-session';

/** Someone named by email: outside the workspace, since workspaces are personal for now. */
function personOf(email: string): Person {
  return { id: email, name: email, email, initials: initialsOf(email), external: true };
}

/** Whether focus is still in a people picker (the field or its list). */
function focusInPicker(): boolean {
  const active = document.activeElement;
  return Boolean(active?.closest('[data-slot="people-picker"], [data-slot="people-picker-popup"]'));
}

/**
 * Who a session is shared with, as the design system's `PeoplePicker`
 * (`ShareSession.dc.html`). Workspaces are personal, so there is no member to
 * suggest: a whole address offers "Invite …". What is still typed is handed
 * up as it changes. The picker clears its text when focus leaves it, so a
 * whole address there is taken as a chip at that moment: leaving the field,
 * or pressing Share, never drops it. People already on the share are never
 * added twice.
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
  const lastTyped = useRef('');

  function commit(people: string[]) {
    onChange(people.filter((email) => !exclude.includes(email)));
  }

  return (
    <PeoplePicker
      people={[]}
      value={value.map(personOf)}
      onValueChange={(next) => commit(next.map((person) => person.email.toLowerCase()))}
      onQueryChange={(text) => {
        if (text === '' && lastTyped.current && !focusInPicker()) {
          const people = namedPeople({ people: value, typed: lastTyped.current });
          if (people.length !== value.length) commit(people);
        }
        lastTyped.current = text;
        onTyped(text);
      }}
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
